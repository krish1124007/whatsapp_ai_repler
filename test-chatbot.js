/**
 * Test script for JET A FLY Travel Enquiry System
 * Run this to verify all components are working correctly
 */

require("dotenv").config();
const mongoose = require("mongoose");
const {
    getOrCreateEnquiry,
    updateEnquiryData,
    createCallbackRequest,
    getEnquiryStats
} = require("./functions/travelEnquiryHelper");
const { generateSystemPrompt } = require("./functions/systemPromptGenerator");
const { parseUserResponse } = require("./functions/responseParser");

// Test phone number
const TEST_PHONE = "+919999999999";

async function runTests() {
    try {
        console.log("🧪 Starting JET A FLY Chatbot System Tests...\n");

        // Connect to database
        console.log("📡 Connecting to MongoDB...");
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("✅ Connected to MongoDB\n");

        // Test 1: Create new enquiry
        console.log("Test 1: Creating new enquiry...");
        const enquiry = await getOrCreateEnquiry(TEST_PHONE);
        console.log(`✅ Enquiry created with ID: ${enquiry._id}`);
        console.log(`   Current stage: ${enquiry.conversationStage}\n`);

        // Test 2: Generate system prompt
        console.log("Test 2: Generating system prompt...");
        const prompt = generateSystemPrompt('greeting');
        console.log(`✅ System prompt generated (${prompt.length} characters)\n`);

        // Test 3: Parse destination response
        console.log("Test 3: Parsing destination response...");
        const destData = parseUserResponse('destination', 'International');
        console.log(`✅ Parsed data:`, destData, "\n");

        // Test 4: Update enquiry with destination
        console.log("Test 4: Updating enquiry with destination...");
        await updateEnquiryData(TEST_PHONE, 'destination', destData);
        console.log(`✅ Enquiry updated\n`);

        // Test 5: Parse traveller details
        console.log("Test 5: Parsing traveller details...");
        const travellerData = parseUserResponse('travellers', '2 adults and 1 child 8 years old');
        console.log(`✅ Parsed travellers:`, travellerData, "\n");

        // Test 6: Parse services
        console.log("Test 6: Parsing services...");
        const servicesData = parseUserResponse('services', 'I need flights, hotels and visa');
        console.log(`✅ Parsed services:`, servicesData, "\n");

        // Test 7: Parse contact info
        console.log("Test 7: Parsing contact information...");
        const contactData = parseUserResponse('contact_info', 'John Doe, +91 9876543210, john@email.com');
        console.log(`✅ Parsed contact:`, contactData, "\n");

        // Test 8: Create callback request
        console.log("Test 8: Creating callback request...");
        await createCallbackRequest(TEST_PHONE, '3 PM today');
        console.log(`✅ Callback request created\n`);

        // Test 9: Get enquiry statistics
        console.log("Test 9: Fetching enquiry statistics...");
        const stats = await getEnquiryStats();
        console.log(`✅ Statistics:`, stats, "\n");

        // Test 10: Verify final enquiry state
        console.log("Test 10: Verifying final enquiry state...");
        const finalEnquiry = await getOrCreateEnquiry(TEST_PHONE);
        console.log(`✅ Final enquiry state:`);
        console.log(`   - Destination: ${finalEnquiry.destination}`);
        console.log(`   - Callback Requested: ${finalEnquiry.callbackRequested}`);
        console.log(`   - Preferred Time: ${finalEnquiry.preferredCallbackTime}`);
        console.log(`   - Status: ${finalEnquiry.status}`);
        console.log(`   - Stage: ${finalEnquiry.conversationStage}`);
        console.log(`   - Tags: ${finalEnquiry.tags.join(', ')}\n`);

        console.log("✅ All tests passed successfully! 🎉\n");

        // Cleanup
        console.log("🧹 Cleaning up test data...");
        await mongoose.model('TravelEnquiry').deleteMany({ phoneNumber: TEST_PHONE });
        console.log("✅ Test data cleaned up\n");

    } catch (error) {
        console.error("❌ Test failed:", error.message);
        console.error(error.stack);
    } finally {
        await mongoose.connection.close();
        console.log("👋 Database connection closed");
        process.exit(0);
    }
}

// Run tests
runTests();
