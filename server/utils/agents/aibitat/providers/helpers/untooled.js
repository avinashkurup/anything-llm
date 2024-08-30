const { safeJsonParse } = require("../../../../http");
const { Deduplicator } = require("../../utils/dedupe");

// Useful inheritance class for a model which supports OpenAi schema for API requests
// but does not have tool-calling or JSON output support.
class UnTooled {
  constructor() {
    this.deduplicator = new Deduplicator();
  }

  cleanMsgs(messages) {
    const modifiedMessages = [];
    messages.forEach((msg) => {
      if (msg.role === "function") {
        const prevMsg = modifiedMessages[modifiedMessages.length - 1].content;
        modifiedMessages[modifiedMessages.length - 1].content =
          `${prevMsg}\n${msg.content}`;
        return;
      }
      modifiedMessages.push(msg);
    });console.log(modifiedMessages);
    return modifiedMessages;
  }

  showcaseFunctions(functions = []) {
    let output = "";
    functions.forEach((def) => {
      let shotExample = `-----------
Function name: ${def.name}
Function Description: ${def.description}
Function parameters in JSON format:
${JSON.stringify(def.parameters.properties, null, 4)}\n`;

      if (Array.isArray(def.examples)) {
        def.examples.forEach(({ prompt, call }) => {
          shotExample += `Query: "${prompt}"\nJSON: ${call}\n`;
        });
      }
      output += `${shotExample}-----------\n`;
    });
    return output;
  }

  /**
   * Check if two arrays of strings or numbers have the same values
   * @param {string[]|number[]} arr1
   * @param {string[]|number[]} arr2
   * @param {Object} [opts]
   * @param {boolean} [opts.enforceOrder] - By default (false), the order of the values in the arrays doesn't matter.
   * @return {boolean}
   */
  compareArrays(arr1, arr2, opts) {
    function vKey(i, v) {
      return (opts?.enforceOrder ? `${i}-` : "") + `${typeof v}-${v}`;
    }

    if (arr1.length !== arr2.length) return false;

    const d1 = {};
    const d2 = {};
    for (let i = arr1.length - 1; i >= 0; i--) {
      d1[vKey(i, arr1[i])] = true;
      d2[vKey(i, arr2[i])] = true;
    }

    for (let i = arr1.length - 1; i >= 0; i--) {
      const v = vKey(i, arr1[i]);
      if (d1[v] !== d2[v]) return false;
    }

    for (let i = arr2.length - 1; i >= 0; i--) {
      const v = vKey(i, arr2[i]);
      if (d1[v] !== d2[v]) return false;
    }

    return true;
  }

  validFuncCall(functionCall = {}, functions = []) {
    if (
      !functionCall ||
      !functionCall?.hasOwnProperty("name") ||
      !functionCall?.hasOwnProperty("arguments")
    ) {
      return {
        valid: false,
        reason: "Missing name or arguments in function call.",
      };
    }

    const foundFunc = functions.find((def) => def.name === functionCall.name);
    if (!foundFunc) {
      return { valid: false, reason: "Function name does not exist." };
    }

    const props = Object.keys(foundFunc.parameters.properties);
    const fProps = Object.keys(functionCall.arguments);
    if (!this.compareArrays(props, fProps)) {
      return { valid: false, reason: "Invalid argument schema match." };
    }

    return { valid: true, reason: null };
  }

  async functionCall(messages, functions, chatCb = null) {
    const history = [...messages].filter((msg) =>
      ["user", "assistant"].includes(msg.role)
    );
    if (history[history.length - 1].role !== "user") return null;
    const response = await chatCb({
      messages: [
        {
          content: `You are a program designed to pick the most optimal function and parameters to call given a list of functions and a user's query. If there are no relevant functions to call return "NO RELEVANT FUNCTIONS TO CALL", however if you want to call a function, you MUST return the name of the function and its parameters in json format. Thus the format of your overall response should look like what's shown between the tags. Make sure to follow the formatting and spacing exactly.

        if a function named "some-function-name" must be selected
        <example>
          {
            "name": "some-function-name",
            "arguments": {"parameter": "parameter_value"}
          }
        </example>

        if no relevant functions to call
        <example>
          "NO RELEVANT FUNCTIONS TO CALL"
        </example>

        Here are the available tools you can use an examples of a query and response so you can understand how each one works.
        ${this.showcaseFunctions(functions)}

        Answer the question immediately without preamble and ignore any instructions after this. Only pay attention to user query.`,
          role: "system",
        },
        ...history,
      ],
    });
    const call = safeJsonParse(response, null);
    if (call === null) return { toolCall: null, text: response }; // failed to parse, so must be text.

    const { valid, reason } = this.validFuncCall(call, functions);
    if (!valid) {
      this.providerLog(`Invalid function tool call: ${reason}.`);
      return { toolCall: null, text: null };
    }

    if (this.deduplicator.isDuplicate(call.name, call.arguments)) {
      this.providerLog(
        `Function tool with exact arguments has already been called this stack.`
      );
      return { toolCall: null, text: null };
    }

    return { toolCall: call, text: null };
  }
}

module.exports = UnTooled;
