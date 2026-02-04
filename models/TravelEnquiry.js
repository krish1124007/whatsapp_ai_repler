const mongoose = require('mongoose');

const travelEnquirySchema = new mongoose.Schema({
    phoneNumber: {
        type: String,
        required: true,
        index: true
    },
    clientName: {
        type: String,
        default: null
    },
    email: {
        type: String,
        default: null
    },

    // Destination Details
    destination: {
        type: String, // Domestic / International
        default: null
    },
    preferredTravelDates: {
        type: String,
        default: null
    },
    numberOfDaysNights: {
        type: String,
        default: null
    },

    // Traveller Details
    totalTravellers: {
        adults: { type: Number, default: 0 },
        children: [{ age: Number }],
        infants: { type: Number, default: 0 }
    },
    departureCity: {
        type: String,
        default: null
    },

    // Hotel & Meal Preferences
    hotelCategory: {
        type: String, // Budget / 3★ / 4★ / 5★
        default: null
    },
    roomRequirement: {
        type: String,
        default: null
    },
    mealPlan: {
        type: String,
        default: null
    },

    // Services Required
    servicesRequired: {
        flights: { type: Boolean, default: false },
        hotels: { type: Boolean, default: false },
        transfers: { type: Boolean, default: false },
        sightseeing: { type: Boolean, default: false },
        visa: { type: Boolean, default: false },
        travelInsurance: { type: Boolean, default: false }
    },

    // Budget & Trip Type
    approximateBudget: {
        type: String,
        default: null
    },
    tripType: {
        type: String, // Family / Honeymoon / Group / Corporate / Religious
        default: null
    },
    specialRequirements: {
        type: String,
        default: null
    },

    // Passport Details (for international trips)
    passportDetails: {
        hasPassport: { type: Boolean, default: null },
        passportNumber: { type: String, default: null },
        expiryDate: { type: String, default: null }
    },

    // Callback Request
    callbackRequested: {
        type: Boolean,
        default: false
    },
    preferredCallbackTime: {
        type: String,
        default: null
    },

    // Status & Tags
    status: {
        type: String,
        enum: ['new', 'in_progress', 'contacted', 'converted', 'closed'],
        default: 'new'
    },
    tags: [{
        type: String // e.g., 'honeymoon', 'group', 'international'
    }],

    // Conversation Progress
    conversationStage: {
        type: String,
        enum: [
            'greeting',
            'destination',
            'travel_dates',
            'hotel_details',
            'budget_triptype',
            'days_nights',
            'travellers',
            'departure_city',
            'hotel_category',
            'room_requirement',
            'meal_plan',
            'services',
            'budget',
            'trip_type',
            'special_requirements',
            'passport_details',
            'contact_info',
            'callback_or_contact',
            'completed'
        ],
        default: 'greeting'
    },

    // Metadata
    collectedData: {
        type: Map,
        of: mongoose.Schema.Types.Mixed,
        default: {}
    },

    // Timestamps
    enquiryDate: {
        type: Date,
        default: Date.now
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Indexes for faster queries
travelEnquirySchema.index({ phoneNumber: 1, createdAt: -1 });
travelEnquirySchema.index({ status: 1 });
travelEnquirySchema.index({ tags: 1 });
travelEnquirySchema.index({ callbackRequested: 1 });

// Auto-tag based on trip type
travelEnquirySchema.pre('save', function () {
    // Auto-tag honeymoon trips
    if (this.tripType && this.tripType.toLowerCase().includes('honeymoon')) {
        if (!this.tags.includes('honeymoon')) {
            this.tags.push('honeymoon');
        }
    }

    // Auto-tag group trips
    if (this.tripType && this.tripType.toLowerCase().includes('group')) {
        if (!this.tags.includes('group')) {
            this.tags.push('group');
        }
    }

    // Auto-tag international trips
    if (this.destination && this.destination.toLowerCase().includes('international')) {
        if (!this.tags.includes('international')) {
            this.tags.push('international');
        }
    }

    // Update lastUpdated
    this.lastUpdated = Date.now();
});

module.exports = mongoose.model('TravelEnquiry', travelEnquirySchema);
