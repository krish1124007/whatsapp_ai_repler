const TravelEnquiry = require('../models/TravelEnquiry');

/**
 * Get or create a travel enquiry for a phone number
 */
async function getOrCreateEnquiry(phoneNumber) {
    try {
        let enquiry = await TravelEnquiry.findOne({
            phoneNumber,
            status: { $in: ['new', 'in_progress'] }
        }).sort({ createdAt: -1 });

        if (!enquiry) {
            enquiry = new TravelEnquiry({
                phoneNumber,
                conversationStage: 'greeting'
            });
            await enquiry.save();
            console.log(`✅ Created new travel enquiry for ${phoneNumber}`);
        }

        return enquiry;
    } catch (error) {
        console.error('❌ Error in getOrCreateEnquiry:', error);
        throw error;
    }
}

/**
 * Update enquiry data based on conversation stage
 */
async function updateEnquiryData(phoneNumber, stage, data) {
    try {
        const enquiry = await getOrCreateEnquiry(phoneNumber);

        // Update the specific field based on stage
        switch (stage) {
            case 'destination':
                enquiry.destination = data.destination;
                enquiry.conversationStage = 'travel_dates';
                break;

            case 'travel_dates':
                // Handle basic trip details (5-6 questions)
                if (data.dates) enquiry.preferredTravelDates = data.dates;
                if (data.daysNights) enquiry.numberOfDaysNights = data.daysNights;
                if (data.travellers) enquiry.totalTravellers = data.travellers;
                if (data.city) enquiry.departureCity = data.city;
                if (data.category) enquiry.hotelCategory = data.category;
                if (data.rooms) enquiry.roomRequirement = data.rooms;

                // Move to hotel details (meal plan & services)
                enquiry.conversationStage = 'hotel_details';
                break;

            case 'hotel_details':
                // Handle meal plan and services
                if (data.mealPlan) enquiry.mealPlan = data.mealPlan;
                if (data.services) enquiry.servicesRequired = data.services;

                // Move to budget & trip type
                enquiry.conversationStage = 'budget_triptype';
                break;

            case 'budget_triptype':
                // Handle budget, trip type, special requirements, passport
                if (data.budget) enquiry.approximateBudget = data.budget;
                if (data.tripType) enquiry.tripType = data.tripType;
                if (data.requirements) enquiry.specialRequirements = data.requirements;
                if (data.passport) enquiry.passportDetails = data.passport;

                // Move to contact info
                enquiry.conversationStage = 'contact_info';
                break;

            case 'days_nights':
                enquiry.numberOfDaysNights = data.daysNights;
                enquiry.conversationStage = 'travellers';
                break;

            case 'travellers':
                enquiry.totalTravellers = data.travellers;
                enquiry.conversationStage = 'departure_city';
                break;

            case 'departure_city':
                enquiry.departureCity = data.city;
                enquiry.conversationStage = 'hotel_category';
                break;

            case 'hotel_category':
                enquiry.hotelCategory = data.category;
                enquiry.conversationStage = 'room_requirement';
                break;

            case 'room_requirement':
                enquiry.roomRequirement = data.rooms;
                enquiry.conversationStage = 'meal_plan';
                break;

            case 'meal_plan':
                enquiry.mealPlan = data.mealPlan;
                enquiry.conversationStage = 'services';
                break;

            case 'services':
                enquiry.servicesRequired = data.services;
                enquiry.conversationStage = 'budget';
                break;

            case 'budget':
                enquiry.approximateBudget = data.budget;
                enquiry.conversationStage = 'trip_type';
                break;

            case 'trip_type':
                enquiry.tripType = data.tripType;
                enquiry.conversationStage = 'special_requirements';
                break;

            case 'special_requirements':
                enquiry.specialRequirements = data.requirements;
                // Check if international trip
                if (enquiry.destination && enquiry.destination.toLowerCase().includes('international')) {
                    enquiry.conversationStage = 'passport_details';
                } else {
                    enquiry.conversationStage = 'contact_info';
                }
                break;

            case 'passport_details':
                enquiry.passportDetails = data.passport;
                enquiry.conversationStage = 'contact_info';
                break;

            case 'contact_info':
                if (data.name) enquiry.clientName = data.name;
                if (data.email) enquiry.email = data.email;
                enquiry.conversationStage = 'callback_or_contact';
                break;

            case 'callback_request':
                enquiry.callbackRequested = true;
                enquiry.preferredCallbackTime = data.preferredTime || 'ASAP';
                enquiry.conversationStage = 'completed';
                enquiry.status = 'in_progress';
                break;

            case 'completed':
                enquiry.conversationStage = 'completed';
                enquiry.status = 'in_progress';
                break;
        }

        // Store in collectedData as well for reference
        enquiry.collectedData.set(stage, data);

        await enquiry.save();
        console.log(`✅ Updated enquiry for ${phoneNumber} - Stage: ${stage}`);

        return enquiry;
    } catch (error) {
        console.error('❌ Error in updateEnquiryData:', error);
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

        console.log(`✅ Callback request created for ${phoneNumber}`);
        return enquiry;
    } catch (error) {
        console.error('❌ Error in createCallbackRequest:', error);
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
        console.error('❌ Error in getCurrentStage:', error);
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
        console.error('❌ Error in getAllEnquiries:', error);
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
        console.error('❌ Error in getEnquiryById:', error);
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

        console.log(`✅ Updated enquiry ${id} status to ${status}`);
        return enquiry;
    } catch (error) {
        console.error('❌ Error in updateEnquiryStatus:', error);
        throw error;
    }
}

/**
 * Get enquiry statistics
 */
async function getEnquiryStats() {
    try {
        const total = await TravelEnquiry.countDocuments();
        const newEnquiries = await TravelEnquiry.countDocuments({ status: 'new' });
        const inProgress = await TravelEnquiry.countDocuments({ status: 'in_progress' });
        const callbackRequests = await TravelEnquiry.countDocuments({ callbackRequested: true, status: { $in: ['new', 'in_progress'] } });
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
        console.error('❌ Error in getEnquiryStats:', error);
        throw error;
    }
}

module.exports = {
    getOrCreateEnquiry,
    updateEnquiryData,
    createCallbackRequest,
    getCurrentStage,
    getAllEnquiries,
    getEnquiryById,
    updateEnquiryStatus,
    getEnquiryStats
};
