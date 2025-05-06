# Quiz Data

Place your questions files in this folder In JSON format (see [mcqs_sample.json](mcqs_sample.json))

Create a `manifest.json` file to provide the file references and link to each topic. For example:

```json
{
  "name": "My Awesome Quiz",
  "topics": [
    {
      "file": "topic_1.json",
      "topic": "Topic 1"
    },
    {
      "file": "topic_2.json",
      "topic": "Topic 2"
    }
  ]
}
```