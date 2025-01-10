const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const tsj = require('ts-json-schema-generator');

const assistantId = "";
const apiKey = "";

// Path to component directory
const componentsDir = path.resolve(__dirname, 'src/components');

const client = new OpenAI({ apiKey });

const getPrompt = (componentName, componentCode, schema) => {
  return `Generate a Storybook file for the following React component:
### Component Name:
${componentName}

### Component Code:
${componentCode}

### JSON Schema of properties:
${JSON.stringify(schema)}`

}

const generateStoryWithOpenAI = async (prompt) => {
  // Start a new thread with the assistant
  const thread = await client.beta.threads.create({
    messages: [
      { role: "user", content: "You are generating content for Storybook for a guitar store website." },
      { role: "user", content: prompt },
      { role: "user", content: "Create 3 unique stories." },
      { role: "user", content: "Include 3-5 sentences for the description field." },
    ],
  });

  // Retrieve the thread ID for further processing
  const threadId = thread.id;

  // Poll for the completion of the thread's run
  await client.beta.threads.runs.createAndPoll(threadId, {
    assistant_id: assistantId,
  });

  // Fetch the completed messages from the thread
  const threadMessages = await client.beta.threads.messages.list(threadId);

  // Extract and return the generated content
  return threadMessages.data[0].content[0].text.value;
};

const generateTypeSchema = (typesPath) => {
  const config = {
    path: typesPath,
    tsconfig: "./tsconfig.json",
    type: "*", // Or <type-name> if you want to generate schema for that one type only
  };

  tsj.createGenerator(config).createSchema(config.type);

  return tsj.createGenerator(config).createSchema(config.type);
};

const splitResponse = (response) => {
  const formatOutput = (text) => text.replace(/```[a-z]*\n?/g, '').replace(/```/g, '');
  const split = response.split("@@@@@@");

  return {
    mockContent: formatOutput(split[0]),
    storiesContent: formatOutput(split[1]),
  };
};

const generateStoryForComponent = async (componentName) => {
  const componentDir = path.join(componentsDir, componentName);
  const componentFile = path.join(componentDir, `${componentName}.tsx`);
  const componentTypesFile = path.join(componentDir, `${componentName}.types.ts`);

  if (!fs.existsSync(componentFile)) {
    console.error(`Component file not found: ${componentFile}`);
    return;
  }

  const props = generateTypeSchema(componentTypesFile);
  const componentCode = fs.readFileSync(componentFile, 'utf-8');
  const prompt = getPrompt(componentName, componentCode, props);
  const storyContent = await generateStoryWithOpenAI(prompt);

  const { mockContent, storiesContent } = splitResponse(storyContent);

  if (storiesContent && mockContent) {
    fs.writeFileSync(path.join(componentDir, `${componentName}.stories.tsx`), storiesContent);
    fs.writeFileSync(path.join(componentDir, `${componentName}.mock.ts`), mockContent);
    console.log(`Stories and mocks generated successfully for ${componentName}.`);
  } else {
    console.error(`Failed to generate stories for ${componentName}.`);
  }
};

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Please provide a component name as an argument.');
  process.exit(1);
}

const componentName = args[0];
generateStoryForComponent(componentName);