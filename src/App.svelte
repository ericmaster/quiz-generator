<script>
  import { onMount } from "svelte";
  import Questions from "./components/Questions.svelte";
  import Result from "./components/Result.svelte";
  import { shuffleArray } from "./lib/utils.js";
  let quiz_name = "";
  let manifest = {};
  let topics = [];
  let questions = [];
  let userAnswers = [];
  let result = "";

  async function loadManifest() {
    const response = await fetch("data/manifest.json");
    manifest = await response.json();
    quiz_name = manifest.name;
    topics = manifest.topics.map((topic) => ({ ...topic, selected: false }));
  }

  async function loadQuiz() {
    const selectedTopics = topics.filter((topic) => topic.selected);
    const selectedFiles = selectedTopics.length
      ? selectedTopics.map((topic) => `data/${topic.file}`)
      : topics.map((topic) => `data/${topic.file}`);

    const filePromises = selectedFiles.map((file) =>
      fetch(file).then((res) => res.json())
    );
    const allQuestions = (await Promise.all(filePromises)).flat();
    questions = shuffleArray(allQuestions).slice(0, 20);
  }

  function submitQuiz() {
    let score = 0;
    const detailedResults = [];

    questions.forEach((q, i) => {
      const isCorrect = userAnswers[i] === q.answer;
      if (isCorrect) {
        score++;
      }
      detailedResults.push({
        question: q.question,
        userAnswer: userAnswers[i] || "No answer selected",
        correctAnswer: q.answer,
        explanation: q.explanation || "No explanation provided.",
        isCorrect,
      });
    });

    result = { score, total: questions.length, detailedResults };
  }

  onMount(() => {
    loadManifest();
  });

  $: {
    if (quiz_name) {
      document.title = `${quiz_name} Quiz`;
    }
  }
</script>

<main class="bg-gray-100 text-gray-800 font-sans p-6">
  <h1 class="text-3xl font-bold text-center text-green-600 mb-8">
    {quiz_name} Quiz
  </h1>

  {#if topics.length > 1}
    <div id="topics" class="bg-white p-6 rounded-lg shadow-md mb-6">
      <h3 class="text-xl font-semibold mb-4">Select Topics:</h3>
      {#each topics as topic}
        <label class="block mb-2">
          <input
            type="checkbox"
            bind:checked={topic.selected}
            value={topic.topic}
            class="mr-2"
          />
          {topic.topic}
        </label>
      {/each}
    </div>
  {/if}

  <div class="flex justify-center gap-4 mb-6">
    <button
      on:click={loadQuiz}
      class="bg-green-500 text-white px-6 py-2 rounded-lg shadow hover:bg-green-600"
    >
      Load Quiz
    </button>
  </div>

  {#if questions.length > 0}
    <Questions {questions} bind:userAnswers />

    <div class="flex justify-center gap-4 mb-6">
      <button
        on:click={submitQuiz}
        class="bg-blue-500 text-white px-6 py-2 rounded-lg shadow hover:bg-blue-600"
      >
        Submit
      </button>
    </div>
  {/if}

  {#if result}
    <Result {result} />
  {/if}
</main>
