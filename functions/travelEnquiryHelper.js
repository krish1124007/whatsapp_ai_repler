const TravelEnquiry = require('../models/TravelEnquiry');
const { parseComprehensiveResponse } = require('./responseParser');
const { extractDataWithAI } = require('./llmDataExtractor'); // Import the new AI extractor


function validateData(value) {
    if (!value) return null;
    if (typeof value === 'string') {
        const lower = value.toLowerCase().trim();
        if (lower === 'null' || lower === 'undefined' || lower === 'none' || lower === 'n/a') return null;
        return value.trim();
    }
    return value;
}

function derivePeopleCount(travellers) {
    if (!travellers) return null;
    if (typeof travellers === 'number') return travellers;

    if (typeof travellers === 'string') {
        const match = travellers.match(/\d+/);
        return match ? parseInt(match[0], 10) : null;
    }

    if (typeof travellers === 'object') {
        let total = 0;
        if (typeof travellers.adults === 'number') total += travellers.adults;
        if (Array.isArray(travellers.children)) total += travellers.children.length;
        if (typeof travellers.infants === 'number') total += travellers.infants;
        return total || null;
    }

    return null;
}

function applyParsedData(enquiry, data = {}) {
    if (data.destination) enquiry.destination = validateData(data.destination);
    if (data.city) enquiry.departureCity = validateData(data.city);
    if (data.dates) enquiry.preferredTravelDates = validateData(data.dates);
    if (data.daysNights) enquiry.numberOfDaysNights = validateData(data.daysNights);
    if (data.travellers) {
        enquiry.totalTravellers = data.travellers;
        const peopleCount = derivePeopleCount(data.travellers);
        if (peopleCount) enquiry.numberOfPeople = peopleCount;
    }
    if (data.category) enquiry.hotelCategory = validateData(data.category);
    if (data.rooms) enquiry.roomRequirement = validateData(data.rooms);
    if (data.mealPlan) enquiry.mealPlan = validateData(data.mealPlan);
    if (data.services) enquiry.servicesRequired = data.services;
    if (data.budget) enquiry.approximateBudget = validateData(data.budget);
    if (data.tripType) enquiry.tripType = validateData(data.tripType);
    if (data.requirements) enquiry.specialRequirements = validateData(data.requirements);
    if (data.passport) enquiry.passportDetails = data.passport;
    if (data.name) enquiry.clientName = validateData(data.name);
    if (data.email) enquiry.email = validateData(data.email);
    if (data.travelType) enquiry.travelType = validateData(data.travelType);
}

function hasAnyCoreTravelData(enquiry) {
    return Boolean(
        enquiry.clientName ||
        enquiry.destination ||
        enquiry.preferredTravelDates ||
        enquiry.travelType ||
        enquiry.approximateBudget
    );
}

function hasAllPrimaryFields(enquiry) {
    return Boolean(
        enquiry.clientName &&
        enquiry.destination &&
        enquiry.preferredTravelDates &&
        enquiry.travelType &&
        enquiry.approximateBudget
    );
}

function getMissingPrimaryFields(enquiry) {
    const missing = [];
    if (!enquiry.clientName) missing.push('name');
    if (!enquiry.destination) missing.push('destination');
    if (!enquiry.preferredTravelDates) missing.push('travelDate');
    if (!enquiry.travelType) missing.push('travelType');
    if (!enquiry.approximateBudget) missing.push('budget');
    return missing;
}

/**
 * Get or create a travel enquiry for a phone number (phone is logical unique key)
 */
async function getOrCreateEnquiry(phoneNumber) {
    try {
        let enquiry = await TravelEnquiry.findOne({ phoneNumber }).sort({ updatedAt: -1 });

        if (!enquiry) {
            enquiry = new TravelEnquiry({
                phoneNumber,
                conversationStage: 'greeting'
            });
            await enquiry.save();
            console.log(`Created new travel enquiry for ${phoneNumber}`);
        }

        return enquiry;
    } catch (error) {
        console.error('Error in getOrCreateEnquiry:', error);
        throw error;
    }
}

/**
 * Unified upsert from every incoming message.
 * This is the primary storage function to avoid stage-based data loss.
 */
async function upsertEnquiryFromMessage(phoneNumber, messageText) {
    try {
        const enquiry = await getOrCreateEnquiry(phoneNumber);
        const regexData = parseComprehensiveResponse(messageText || '');

        // Use AI extraction for better understanding (handles "1 lakh", context, etc.)
        let llmData = {};
        try {
            llmData = await extractDataWithAI(messageText, enquiry);
            console.log(`🤖 AI Extracted Data for ${phoneNumber}:`, JSON.stringify(llmData));
        } catch (aiError) {
            console.error('AI Extraction Failed, falling back to regex:', aiError);
        }

        // Check for specific intent first (new trip / cancel)
        if (llmData.intent === 'new_trip' || llmData.intent === 'cancel') {
            await resetEnquiry(phoneNumber);
            // Re-fetch clean enquiry
            const newEnquiry = await getOrCreateEnquiry(phoneNumber);
            return { enquiry: newEnquiry, parsedData: {}, isReset: true };
        }

        // Merge data: AI data takes precedence as it's smarter
        const parsedData = { ...regexData, ...llmData };

        // Ensure numeric fields are consistent if strings were returned
        if (llmData.budget && typeof llmData.budget === 'string') {
            // specialized cleanup if needed, but the prompt handles most
        }

        applyParsedData(enquiry, parsedData);

        if (hasAnyCoreTravelData(enquiry)) {
            enquiry.status = 'in_progress';
            // Only set callback requested if it wasn't already set or if explicitly requested again
            // But logic: if we have core data, we assume active interest
            if (!enquiry.callbackRequested) {
                enquiry.callbackRequested = true;
                enquiry.preferredCallbackTime = 'ASAP';
            }
        }

        enquiry.conversationStage = hasAllPrimaryFields(enquiry) ? 'contact_info' : 'travel_dates';

        enquiry.collectedData.set(`msg_${Date.now()}`, {
            rawText: messageText,
            parsedData
        });

        await enquiry.save();

        return {
            enquiry,
            parsedData,
            missingPrimaryFields: getMissingPrimaryFields(enquiry),
            hasAllPrimaryFields: hasAllPrimaryFields(enquiry),
            isReset: false
        };
    } catch (error) {
        console.error('Error in upsertEnquiryFromMessage:', error);
        throw error;
    }
}

/**
 * Update enquiry data based on conversation stage
 */
async function updateEnquiryData(phoneNumber, stage, data) {
    try {
        const enquiry = await getOrCreateEnquiry(phoneNumber);

        switch (stage) {
            case 'greeting':
                applyParsedData(enquiry, data);
                enquiry.conversationStage = hasAllPrimaryFields(enquiry)
                    ? 'contact_info'
                    : 'travel_dates';
                break;

            case 'destination':
                enquiry.destination = data.destination;
                enquiry.conversationStage = 'travel_dates';
                break;

            case 'travel_dates':
            case 'hotel_details':
            case 'budget_triptype':
                applyParsedData(enquiry, data);
                enquiry.conversationStage = hasAllPrimaryFields(enquiry)
                    ? 'contact_info'
                    : 'travel_dates';
                break;

            case 'days_nights':
                enquiry.numberOfDaysNights = data.daysNights;
                enquiry.conversationStage = 'travel_dates';
                break;

            case 'travellers':
                enquiry.totalTravellers = data.travellers;
                enquiry.numberOfPeople = derivePeopleCount(data.travellers) || enquiry.numberOfPeople;
                enquiry.conversationStage = 'travel_dates';
                break;

            case 'departure_city':
                enquiry.departureCity = data.city;
                enquiry.conversationStage = 'travel_dates';
                break;

            case 'hotel_category':
                enquiry.hotelCategory = data.category;
                enquiry.conversationStage = 'travel_dates';
                break;

            case 'room_requirement':
                enquiry.roomRequirement = data.rooms;
                enquiry.conversationStage = 'travel_dates';
                break;

            case 'meal_plan':
                enquiry.mealPlan = data.mealPlan;
                enquiry.conversationStage = 'travel_dates';
                break;

            case 'services':
                enquiry.servicesRequired = data.services;
                enquiry.conversationStage = 'travel_dates';
                break;

            case 'budget':
                enquiry.approximateBudget = data.budget;
                enquiry.conversationStage = 'travel_dates';
                break;

            case 'trip_type':
                enquiry.tripType = data.tripType;
                enquiry.conversationStage = 'travel_dates';
                break;

            case 'special_requirements':
                enquiry.specialRequirements = data.requirements;
                enquiry.conversationStage = 'travel_dates';
                break;

            case 'passport_details':
                enquiry.passportDetails = data.passport;
                enquiry.conversationStage = 'travel_dates';
                break;

            case 'contact_info':
                applyParsedData(enquiry, data);
                enquiry.callbackRequested = hasAnyCoreTravelData(enquiry);
                enquiry.preferredCallbackTime = enquiry.preferredCallbackTime || 'ASAP';
                enquiry.conversationStage = 'completed';
                enquiry.status = 'in_progress';
                break;

            case 'callback_request':
                enquiry.callbackRequested = true;
                enquiry.preferredCallbackTime = data.preferredTime || 'ASAP';
                enquiry.conversationStage = 'completed';
                enquiry.status = 'in_progress';
                break;

            case 'completed':
                applyParsedData(enquiry, data);
                enquiry.conversationStage = 'completed';
                enquiry.status = 'in_progress';
                break;
        }

        enquiry.collectedData.set(stage, data);

        await enquiry.save();
        console.log(`Updated enquiry for ${phoneNumber} - Stage: ${stage}`);

        return enquiry;
    } catch (error) {
        console.error('Error in updateEnquiryData:', error);
        throw error;
    }
}

/**
 * Create a callback request
 */
async function createCallbackRequest(phoneNumber, preferredTime = 'ASAP') {
    try {
        const enquiry = await getOrCreateEnquiry(phoneNumber);

        enquiry.callbackRequested = true;
        enquiry.preferredCallbackTime = preferredTime;
        enquiry.status = 'in_progress';
        enquiry.conversationStage = 'completed';

        await enquiry.save();

        console.log(`Callback request created for ${phoneNumber}`);
        return enquiry;
    } catch (error) {
        console.error('Error in createCallbackRequest:', error);
        throw error;
    }
}

/**
 * Get current conversation stage
 */
async function getCurrentStage(phoneNumber) {
    try {
        const enquiry = await getOrCreateEnquiry(phoneNumber);
        return enquiry.conversationStage;
    } catch (error) {
        console.error('Error in getCurrentStage:', error);
        return 'greeting';
    }
}

/**
 * Get all enquiries with filters
 */
async function getAllEnquiries(filters = {}) {
    try {
        const query = {};

        if (filters.status) query.status = filters.status;
        if (filters.tags) query.tags = { $in: filters.tags };
        if (filters.callbackRequested !== undefined) query.callbackRequested = filters.callbackRequested;
        if (filters.destination) query.destination = new RegExp(filters.destination, 'i');

        const enquiries = await TravelEnquiry.find(query)
            .sort({ createdAt: -1 })
            .limit(filters.limit || 100);

        return enquiries;
    } catch (error) {
        console.error('Error in getAllEnquiries:', error);
        throw error;
    }
}

/**
 * Get enquiry by ID
 */
async function getEnquiryById(id) {
    try {
        return await TravelEnquiry.findById(id);
    } catch (error) {
        console.error('Error in getEnquiryById:', error);
        throw error;
    }
}

/**
 * Update enquiry status
 */
async function updateEnquiryStatus(id, status) {
    try {
        const enquiry = await TravelEnquiry.findById(id);
        if (!enquiry) {
            throw new Error('Enquiry not found');
        }

        enquiry.status = status;
        await enquiry.save();

        console.log(`Updated enquiry ${id} status to ${status}`);
        return enquiry;
    } catch (error) {
        console.error('Error in updateEnquiryStatus:', error);
        throw error;
    }
}

/**
 * Reset enquiry to start fresh
 */
async function resetEnquiry(phoneNumber) {
    try {
        const enquiry = await getOrCreateEnquiry(phoneNumber);

        // Archive or clear fields
        enquiry.status = 'new';
        enquiry.conversationStage = 'greeting';
        enquiry.callbackRequested = false;
        enquiry.preferredCallbackTime = null;

        // Clear specialized fields
        enquiry.destination = null;
        enquiry.departureCity = null;
        enquiry.preferredTravelDates = null;
        enquiry.numberOfDaysNights = null;
        enquiry.numberOfPeople = null;
        enquiry.totalTravellers = null;
        enquiry.hotelCategory = null;
        enquiry.roomRequirement = null;
        enquiry.mealPlan = null;
        enquiry.servicesRequired = null;
        enquiry.approximateBudget = null;
        enquiry.tripType = null;
        enquiry.specialRequirements = null;
        enquiry.passportDetails = null;
        enquiry.travelType = null;
        // Keep name and email if known, as that doesn't change per trip usually?
        // But user asked to "overwrite user data". Let's clear trip-specific data but maybe keep contact info?
        // User request: "if user want to start new than overwirte user data"
        // Let's clear basics, but keep Client Name if it's not null/trash

        // Resetting everything to be safe as per "overwrite" instruction
        // enquiry.clientName = null; // Maybe keep name? Usually CRMs keep name.
        // Let's keep name and email, clear trip details.

        await enquiry.save();
        console.log(`Reset travel enquiry for ${phoneNumber}`);
        return enquiry;
    } catch (error) {
        console.error('Error in resetEnquiry:', error);
        throw error;
    }
}

/**
 * Generate a readable summary of the enquiry
 */
function getEnquirySummary(enquiry) {
    const parts = [];
    if (enquiry.destination) parts.push(`Destination: ${enquiry.destination}`);
    if (enquiry.preferredTravelDates) parts.push(`Dates: ${enquiry.preferredTravelDates}`);
    if (enquiry.numberOfPeople) parts.push(`Travellers: ${enquiry.numberOfPeople}`);
    if (enquiry.approximateBudget) parts.push(`Budget: ${enquiry.approximateBudget}`);
    return parts.join(', ') || 'No details yet';
}

/**
 * Get enquiry statistics
 */
async function getEnquiryStats() {
    try {
        const total = await TravelEnquiry.countDocuments();
        const newEnquiries = await TravelEnquiry.countDocuments({ status: 'new' });
        const inProgress = await TravelEnquiry.countDocuments({ status: 'in_progress' });
        const callbackRequests = await TravelEnquiry.countDocuments({
            callbackRequested: true,
            status: { $in: ['new', 'in_progress'] }
        });
        const honeymoonLeads = await TravelEnquiry.countDocuments({ tags: 'honeymoon' });
        const groupLeads = await TravelEnquiry.countDocuments({ tags: 'group' });
        const internationalLeads = await TravelEnquiry.countDocuments({ tags: 'international' });

        return {
            total,
            newEnquiries,
            inProgress,
            callbackRequests,
            honeymoonLeads,
            groupLeads,
            internationalLeads
        };
    } catch (error) {
        console.error('Error in getEnquiryStats:', error);
        throw error;
    }
}

module.exports = {
    getOrCreateEnquiry,
    upsertEnquiryFromMessage,
    updateEnquiryData,
    createCallbackRequest,
    getCurrentStage,
    getAllEnquiries,
    getEnquiryById,
    updateEnquiryStatus,
    getEnquiryStats,
    resetEnquiry,
    getEnquirySummary
};
