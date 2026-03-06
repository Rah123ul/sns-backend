const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: [true, 'Event title is required'],
            trim: true,
        },
        month: {
            type: String,
            required: [true, 'Month is required'],
            uppercase: true,
            trim: true,
        },
        day: {
            type: String,
            required: [true, 'Day is required'],
            trim: true,
        },
        time: {
            type: String,
            required: [true, 'Time is required'],
            trim: true,
        },
        location: {
            type: String,
            required: [true, 'Location is required'],
            trim: true,
        },
        description: {
            type: String,
            required: [true, 'Description is required'],
            trim: true,
        },
        tag: {
            type: String,
            default: 'Event',
            trim: true,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model('Event', eventSchema);
