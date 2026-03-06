const mongoose = require('mongoose');

const registrationSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Name is required'],
            trim: true,
        },
        email: {
            type: String,
            required: [true, 'Email is required'],
            trim: true,
            lowercase: true,
            match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
        },
        rollNo: {
            type: String,
            required: [true, 'Roll number is required'],
            trim: true,
        },
        phone: {
            type: String,
            required: [true, 'Phone number is required'],
            trim: true,
            match: [/^\d{10}$/, 'Please enter a valid 10-digit phone number'],
        },
        eventId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Event',
            required: [true, 'Event ID is required'],
        },
    },
    { timestamps: true }
);

// Prevent duplicate registrations (same email + same event)
registrationSchema.index({ email: 1, eventId: 1 }, { unique: true });

module.exports = mongoose.model('Registration', registrationSchema);
