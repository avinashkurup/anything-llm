const { CollectorApi } = require("../../../collectorApi");
const Provider = require("../providers/ai-provider");
const { summarizeContent } = require("../utils/summarize");

const { ChatGroq } = require('@langchain/groq');
const { ChatOpenAI } = require('@langchain/openai');
const { ChatPromptTemplate } = require('@langchain/core/prompts');
const { RunnableSequence, RunnablePassthrough } = require('@langchain/core/runnables');
const { StringOutputParser } = require('@langchain/core/output_parsers');
const { DataSource } = require('typeorm');
const { SqlDatabase } = require('langchain/sql_db');

const sqlQueryGenerator = {
  name: "private-chat",
  startupConfig: {
    params: {},
  },
  plugin: function () {
    return {
      name: this.name,
      setup(aibitat) {
        aibitat.function({
          super: aibitat,
          name: this.name,
          controller: new AbortController(),
          description:
            "Generates a SQL query based on the user's question and the database schema, and returns the query's response in natural language.",
          examples: [
            {
              prompt: "Which encounter type is most frequent for patients above 60 years old?",
              call: JSON.stringify({ question: "Which encounter type is most frequent for patients above 60 years old?" }),
            },
          ],
          parameters: {
            $schema: "http://json-schema.org/draft-07/schema#",
            type: "object",
            properties: {
              question: {
                type: "string",
                description: "The user's question about the database.",
              },
            },
            additionalProperties: false,
          },
          handler: async function ({ question }) {
            try {
              console.log("Processing question: ", question);

              if (question) return await this.generateSqlQuery(question);
              return "There is nothing we can do. This function call returns no information.";
            } catch (error) {
              return `There was an error while calling the function. No data or response was found. Let the user know this was the error: ${error.message}`;
            }
          },

          generateSqlQuery: async function (question) {
            const db = await this.createDatabase();
            const model = this.createModel();
            const sqlQueryPrompt = this.createSqlQueryPrompt();
            const finalResponsePrompt = this.createFinalResponsePrompt();
            const sqlQueryGeneratorChain = this.createSqlQueryGeneratorChain(db, model, sqlQueryPrompt);
            const fullChain = this.createFullChain(db, model, sqlQueryGeneratorChain, finalResponsePrompt);

            try {
              const finalResponse = await fullChain.invoke({ question });
              console.log("Final response received from fullChain.invoke:", finalResponse);
              return finalResponse;
            } catch (error) {
              throw new Error(`Error generating SQL query: ${error.message}`);
            }
          },

          createModel: function () {
            return new ChatOpenAI({
              temperature: 0.1,
              configuration: {
                baseURL: process.env.LITE_LLM_BASE_PATH,
              },
              apiKey: process.env.LITE_LLM_API_KEY,
              model: process.env.LITE_LLM_MODEL_PREF,
            });
          },

          createSqlQueryPrompt: function () {
            const template = `
              You are a data analyst at a company. You are interacting with a user who is asking you questions about the company's database.
              Based on the table schema below, write a SQL query that would answer the user's question. Make sure to:
              - Remove unwanted white spaces and use correct syntax.
              - Replace any occurrence of '^' with the 'POWER()' function for exponentiation, as SQLite does not support '^'.
              - Ensure the query is compatible with SQLite.

              <SCHEMA>{schema}</SCHEMA>

              Write only the SQL query and nothing else. Do not wrap the SQL query in any other text, not even backticks.

              For example:
              Question: Which 3 artists have the most tracks?
              SQL Query: SELECT ArtistId, COUNT(*) as track_count FROM Track GROUP BY ArtistId ORDER BY track_count DESC LIMIT 3;

              Your turn:

              Question: {question}
              SQL Query:
            `;
            return ChatPromptTemplate.fromTemplate(template);
          },


          createFinalResponsePrompt: function () {
            const template = `
              You are a data analyst at a company. You are interacting with a user who is asking you questions about the company's database.
              Based on the table schema below, question, sql query, and sql response, write a natural language response.
              <SCHEMA>{schema}</SCHEMA>

              SQL Query: <SQL>{query}</SQL>
              User question: {question}
              SQL Response: {response}
            `;
            return ChatPromptTemplate.fromTemplate(template);
          },

          createSqlQueryGeneratorChain: function (db, model, prompt) {
            return RunnableSequence.from([
              RunnablePassthrough.assign({
                schema: () => __awaiter(this, void 0, void 0, function* () {
                  try {
                    return yield db.getTableInfo(); // Await the result and handle errors
                  } catch (error) {
                    console.error('Error getting table info:', error);
                    throw error; // Propagate the error
                  }
                }),
              }),
              prompt,
              model.bind({ stop: ["\nSQLResult:"] }),
              new StringOutputParser(),
            ]);
          },

          createFullChain: function (db, model, sqlQueryGeneratorChain, finalResponsePrompt) {
            return RunnableSequence.from([
              RunnablePassthrough.assign({
                query: sqlQueryGeneratorChain,
              }),
              {
                schema: () => __awaiter(this, void 0, void 0, function* () {
                  try {
                    return yield db.getTableInfo(); // Await the result and handle errors
                  }
                  catch (error) {
                    console.error("Error getting table info:", error);
                    throw error; // Propagate the error
                  }
                }),
                question: (input) => input.question,
                query: (input) => {
                  const generatedQuery = input.query;
                  console.log(`Generated SQL Query: ${generatedQuery}`);
                  return generatedQuery;
                },
                response: (input) => db.run(input.query),
              },
              finalResponsePrompt,
              model,
              new StringOutputParser(),
            ]);
          },

          createDatabase: async function () {
            try {
              const datasource = new DataSource({
                "type": "sqlite",
                "database": "private-sqlite.db"
              });

              await datasource.initialize();
              return SqlDatabase.fromDataSourceParams({ appDataSource: datasource });
            } catch (error) {
              console.error('Error creating database:', error);
              throw error;
            }
          },
        });
      },
    };
  },
};

module.exports = {
  sqlQueryGenerator,
};
