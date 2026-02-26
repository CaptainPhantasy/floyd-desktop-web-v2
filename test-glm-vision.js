/**
 * Test script to verify GLM-4.6v vision capabilities
 */

import OpenAI from 'openai';

// Test configurations
const TEST_CONFIGS = [
  {
    name: 'Z.ai Endpoint (Default)',
    baseURL: 'https://api.z.ai/api/paas/v4',
    model: 'glm-4.6v'
  },
  {
    name: 'BigModel Endpoint',
    baseURL: 'https://open.bigmodel.cn/api/paas/v4', 
    model: 'glm-4.6v'
  }
];

async function testVisionAPI(config) {
  console.log(`\n🧪 Testing: ${config.name}`);
  console.log(`📍 Endpoint: ${config.baseURL}`);
  console.log(`🤖 Model: ${config.model}`);
  
  const client = new OpenAI({
    apiKey: process.env.GLM_API_KEY || process.env.ZAI_API_KEY,
    baseURL: config.baseURL
  });

  try {
    // Test 1: Simple text request
    console.log('\n📝 Test 1: Simple text...');
    const textResponse = await client.chat.completions.create({
      model: config.model,
      messages: [{ role: 'user', content: 'Say "GLM is working"' }],
      max_tokens: 50
    });
    console.log('✅ Text response:', textResponse.choices[0].message.content);

    // Test 2: Vision request (if we have an image)
    console.log('\n👁️ Test 2: Vision capability check...');
    
    // Create a simple 1x1 pixel PNG in base64
    const tinyImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
    
    const visionResponse = await client.chat.completions.create({
      model: config.model,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'What do you see in this image?'
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:image/png;base64,${tinyImageBase64}`
            }
          }
        ]
      }],
      max_tokens: 100
    });
    
    console.log('✅ Vision response:', visionResponse.choices[0].message.content);
    console.log(`🎯 ${config.name} - SUCCESS: Vision is working!`);
    
  } catch (error) {
    console.log(`❌ ${config.name} - FAILED:`, error.message);
    if (error.status) {
      console.log(`📊 Status: ${error.status}, Code: ${error.code}`);
    }
  }
}

async function main() {
  console.log('🔍 Testing GLM-4.6v Vision Capabilities');
  console.log('=====================================');
  
  for (const config of TEST_CONFIGS) {
    await testVisionAPI(config);
  }
  
  console.log('\n🏁 Testing complete');
}

main().catch(console.error);