import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { expect, test, vi, beforeEach } from 'vitest';
import Page from './+page.svelte';

beforeEach(() => {
  vi.clearAllMocks();
  
  if (typeof window !== 'undefined') {
    window.confirm = vi.fn().mockReturnValue(true);
    window.alert = vi.fn();
  }
});

test('documents page lists documents, polls active ones, allows retry and delete', async () => {
  const initialDocs = [
    {
      id: 'doc-ready',
      filename: 'ready_doc.pdf',
      sizeBytes: 2048,
      status: 'ready',
      createdAt: 1600000000000
    },
    {
      id: 'doc-processing',
      filename: 'proc_doc.txt',
      sizeBytes: 1024,
      status: 'processing',
      createdAt: 1600000000000
    },
    {
      id: 'doc-failed',
      filename: 'failed_doc.md',
      sizeBytes: 512,
      status: 'failed',
      createdAt: 1600000000000
    }
  ];

  // Mock API calls
  globalThis.fetch = vi.fn().mockImplementation((url, init) => {
    if (url === '/api/documents/doc-processing/status') {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ id: 'doc-processing', status: 'ready' })
      });
    }
    if (url === '/api/documents/doc-failed/retry' && init?.method === 'POST') {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });
    }
    if (url === '/api/documents/doc-ready' && init?.method === 'DELETE') {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ deleted: true })
      });
    }
    return Promise.resolve({
      ok: false,
      status: 404
    });
  });

  const dataProp = { documents: initialDocs };
  
  // Render page
  render(Page, { props: { data: dataProp } });

  // 1. Verify all documents are listed
  expect(screen.queryByText('ready_doc.pdf')).not.toBeNull();
  expect(screen.queryByText('proc_doc.txt')).not.toBeNull();
  expect(screen.queryByText('failed_doc.md')).not.toBeNull();

  // Verify statuses
  expect(screen.queryByText('Ready')).not.toBeNull();
  expect(screen.queryByText('Processing')).not.toBeNull();
  expect(screen.queryByText('Failed')).not.toBeNull();

  // 2. Verify status polling updates 'processing' status to 'ready'
  await waitFor(() => {
    // There should now be two 'Ready' documents and zero 'Processing'
    const readyPills = screen.queryAllByText('Ready');
    expect(readyPills.length).toBe(2);
  }, { timeout: 3000 });

  // 3. Test retry action on the failed document
  const retryBtns = screen.queryAllByTitle('Retry Ingestion');
  expect(retryBtns.length).toBe(1);
  await fireEvent.click(retryBtns[0]);
  
  // Confirm it sets status back to processing
  await waitFor(() => {
    expect(screen.queryByText('Processing')).not.toBeNull();
  });

  // 4. Test delete action on ready document
  const deleteBtns = screen.queryAllByTitle('Delete Document');
  expect(deleteBtns.length).toBe(3); // one delete button per document
  await fireEvent.click(deleteBtns[0]); // delete doc-ready

  // Confirm document is removed from UI list
  await waitFor(() => {
    expect(screen.queryByText('ready_doc.pdf')).toBeNull();
  });
});
