const mongoose = require('mongoose');

const travelEnquirySchema = new mongoose.Schema({
    // Essential Contact Information
    phoneNumber: {
        type: String,
        required: true,
        index: true
    },
    clientName: {
        type: String,
        default: null
    },

    // Core Travel Details (Minimal)
    destination: {
        type: String,
        default: null
    },
    departureCity: {
        type: String,
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
    numberOfPeople: {
        type: Number,
        default: 1
    },
    totalTravellers: {
        type: mongoose.Schema.Types.Mixed, // Can be number or object with adults/children
        default: null
    },
    approximateBudget: {
        type: String,
        default: null
    },
    hotelCategory: {
        type: String,
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
    servicesRequired: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    passportDetails: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    email: {
        type: String,
        default: null
    },

    // Optional Additional Info
    tripType: {
        type: String, // Family / Honeymoon / Group / Solo
        default: null
    },
    specialRequirements: {
        type: String,
        default: null
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
            'number_of_people',
            'budget',
            'trip_type',
            'special_requirements',
            'contact_info',
            'callback_or_contact',
            'completed'
        ],
        default: 'greeting'
    },

    // Metadata for any additional collected data
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
