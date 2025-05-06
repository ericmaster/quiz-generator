# Quiz Generator Guidelines for Github Copilot

This is a Svelte based application that helps users generate a multiple choice questions quiz. The questions are created via json using a provided template. The application uses tailwind for the styles. Please follow these guidelines when contributing.

## General Style

- Use camelCase for all variables, functions, and components.
- Use PascalCase for Svelte components.
- Prefer single-line code unless the code is too complex to read.
- Use Svelte's `<style>` tag for component-specific CSS.

## Svelte Component Structure

- Each Svelte component should have a dedicated file (e.g., `MyComponent.svelte`).
- Maintain a consistent structure for Svelte components:
  - `</style>`
  - `</script>`
  - `<template>`
- Follow these conventions:
  - Import necessary modules.
  - Define the component's data (state).
  - Define the component's logic (methods).
  - Render the component's UI.
