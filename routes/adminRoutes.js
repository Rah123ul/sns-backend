const express = require('express');
const router = express.Router();
const Event = require('../models/Event');
const Registration = require('../models/Registration');

// Simple admin password middleware
const adminAuth = (req, res, next) => {
    const password = req.headers['x-admin-password'];
    if (!password || password !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({ message: 'Unauthorized: Invalid admin password' });
    }
    next();
};

// POST /api/admin/login — verify admin password
router.post('/login', (req, res) => {
    const { password } = req.body;
    if (password === process.env.ADMIN_PASSWORD) {
        return res.json({ message: 'Login successful', authenticated: true });
    }
    res.status(401).json({ message: 'Invalid password', authenticated: false });
});

// GET /api/admin/registrations — get all registrations
router.get('/registrations', adminAuth, async (req, res) => {
    try {
        const registrations = await Registration.find()
            .populate('eventId', 'title month day time location')
            .sort({ createdAt: -1 });
        res.json(registrations);
    } catch (error) {
        console.error('Error fetching registrations:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/admin/registrations/:eventId — get registrations for a specific event
router.get('/registrations/:eventId', adminAuth, async (req, res) => {
    try {
        const registrations = await Registration.find({ eventId: req.params.eventId })
            .populate('eventId', 'title month day time location')
            .sort({ createdAt: -1 });
        res.json(registrations);
    } catch (error) {
        console.error('Error fetching registrations:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// DELETE /api/admin/registrations/:id — delete a registration
router.delete('/registrations/:id', adminAuth, async (req, res) => {
    try {
        const registration = await Registration.findByIdAndDelete(req.params.id);
        if (!registration) {
            return res.status(404).json({ message: 'Registration not found' });
        }
        res.json({ message: 'Registration deleted successfully' });
    } catch (error) {
        console.error('Error deleting registration:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/admin/events — create a new event
router.post('/events', adminAuth, async (req, res) => {
    try {
        const { title, month, day, time, location, description, tag } = req.body;

        if (!title || !month || !day || !time || !location || !description) {
            return res.status(400).json({ message: 'All event fields are required' });
        }

        const event = new Event({ title, month, day, time, location, description, tag });
        await event.save();
        res.status(201).json({ message: 'Event created successfully', event });
    } catch (error) {
        console.error('Error creating event:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/admin/events — get all events (including inactive)
router.get('/events', adminAuth, async (req, res) => {
    try {
        const events = await Event.find().sort({ createdAt: -1 });

        // Get registration count for each event
        const eventsWithCount = await Promise.all(
            events.map(async (event) => {
                const count = await Registration.countDocuments({ eventId: event._id });
                return { ...event.toObject(), registrationCount: count };
            })
        );

        res.json(eventsWithCount);
    } catch (error) {
        console.error('Error fetching events:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// DELETE /api/admin/events/:id — delete an event and its registrations
router.delete('/events/:id', adminAuth, async (req, res) => {
    try {
        const event = await Event.findByIdAndDelete(req.params.id);
        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        // Also delete all registrations for this event
        await Registration.deleteMany({ eventId: req.params.id });

        res.json({ message: 'Event and its registrations deleted successfully' });
    } catch (error) {
        console.error('Error deleting event:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
