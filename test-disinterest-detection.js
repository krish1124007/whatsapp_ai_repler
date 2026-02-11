/**
 * Test script for disinterest detection
 * Run: node test-disinterest-detection.js
 */

const { isUserDisinterested } = require('./functions/responseParser');

console.log('🧪 Testing Disinterest Detection\n');

// Test 1: Single "No" without context - should NOT be disinterested
console.log('Test 1: Single "No" (no history)');
const test1 = isUserDisinterested('No', []);
console.log(`Result: ${test1 ? '❌ DISINTERESTED' : '✅ NOT disinterested'}`);
console.log('Expected: ✅ NOT disinterested (single "No" could be answering "any children?")\n');

// Test 2: Strong dismissive phrase - should be disinterested
console.log('Test 2: "not interested"');
const test2 = isUserDisinterested('not interested', []);
console.log(`Result: ${test2 ? '✅ DISINTERESTED' : '❌ NOT disinterested'}`);
console.log('Expected: ✅ DISINTERESTED\n');

// Test 3: "call back me" - should be disinterested
console.log('Test 3: "Can you call back me"');
const test3 = isUserDisinterested('Can you call back me', []);
console.log(`Result: ${test3 ? '✅ DISINTERESTED' : '❌ NOT disinterested'}`);
console.log('Expected: ✅ DISINTERESTED\n');

// Test 4: Multiple "No" responses - should be disinterested
console.log('Test 4: Multiple consecutive "No" responses');
const history4 = [
    { role: 'assistant', content: 'Any children traveling?' },
    { role: 'user', content: 'No' },
    { role: 'assistant', content: 'Any activities?' },
    { role: 'user', content: 'No' },
    { role: 'assistant', content: 'Special requests?' }
];
const test4 = isUserDisinterested('No', history4);
console.log(`Result: ${test4 ? '✅ DISINTERESTED' : '❌ NOT disinterested'}`);
console.log('Expected: ✅ DISINTERESTED (3 consecutive "No" responses)\n');

// Test 5: User providing information - should NOT be disinterested
console.log('Test 5: User providing travel info');
const test5 = isUserDisinterested('Krish, Mumbai to Delhi, 3 march to 10 march', []);
console.log(`Result: ${test5 ? '❌ DISINTERESTED' : '✅ NOT disinterested'}`);
console.log('Expected: ✅ NOT disinterested\n');

// Test 6: "bye" - should be disinterested
console.log('Test 6: "bye"');
const test6 = isUserDisinterested('bye', []);
console.log(`Result: ${test6 ? '✅ DISINTERESTED' : '❌ NOT disinterested'}`);
console.log('Expected: ✅ DISINTERESTED\n');

// Test 7: "Do not want to continue" - should be disinterested
console.log('Test 7: "No do not want to continue"');
const test7 = isUserDisinterested('No do not want to continue', []);
console.log(`Result: ${test7 ? '✅ DISINTERESTED' : '❌ NOT disinterested'}`);
console.log('Expected: ✅ DISINTERESTED\n');

// Test 8: "stop" - should be disinterested
console.log('Test 8: "stop"');
const test8 = isUserDisinterested('stop', []);
console.log(`Result: ${test8 ? '✅ DISINTERESTED' : '❌ NOT disinterested'}`);
console.log('Expected: ✅ DISINTERESTED\n');

console.log('✅ All tests completed!');
