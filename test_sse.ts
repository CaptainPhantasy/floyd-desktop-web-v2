import { TextDecoder } from 'util';

async function testSseParser() {
  console.log("Starting SSE Parser test...");
  
  // Simulate an SSE stream that gets chunked right in the middle of a JSON payload
  const mockChunks = [
    'data: {"type": "text", "content": "Hello',
    ' World"}\n\ndata: {"type": "text", "c',
    'ontent": "!"}\n\ndata: {"type": "done", "usage": {}, "sessionId": "123"}\n\n'
  ];
  
  // Create an async iterator to mock reader.read()
  let chunkIndex = 0;
  const mockReader = {
    read: async () => {
      if (chunkIndex >= mockChunks.length) {
        return { done: true, value: undefined };
      }
      // Encode to Uint8Array like a real network stream
      const value = new TextEncoder().encode(mockChunks[chunkIndex++]);
      return { done: false, value };
    }
  };

  const decoder = new TextDecoder();
  let buffer = '';
  const parsedEvents = [];
  
  while (true) {
    const { done, value } = await mockReader.read();
    if (done) break;
    
    buffer += decoder.decode(value, { stream: true });
    
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6));
          parsedEvents.push(data);
        } catch (e) {
          console.error("PARSE ERROR ON:", line);
        }
      }
    }
  }
  
  console.log("Parsed Events:", parsedEvents);
  if (parsedEvents.length === 3 && parsedEvents[0].content === "Hello World") {
    console.log("✅ SSE Parser Test Passed: Handled split chunks correctly!");
  } else {
    console.error("❌ SSE Parser Test Failed.");
  }
}

testSseParser().catch(console.error);
