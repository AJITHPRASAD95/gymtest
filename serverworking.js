const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// MongoDB connection
mongoose.connect('mongodb://localhost:27017/gym_management', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Schemas
const branchSchema = new mongoose.Schema({
  name: String,
  location: String,
  contact: String,
  createdAt: { type: Date, default: Date.now }
});

const memberSchema = new mongoose.Schema({
  name: String,
  email: String,
  phone: String,
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
  membershipType: String,
  joinDate: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true },
  monthlyFee: Number,
  emergencyContact: String,
  createdAt: { type: Date, default: Date.now }
});

const paymentSchema = new mongoose.Schema({
  memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Member' },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
  amount: Number,
  paymentDate: { type: Date, default: Date.now },
  paymentMonth: String, // Format: "YYYY-MM"
  paymentStatus: { type: String, enum: ['paid', 'pending', 'overdue'], default: 'pending' },
  paymentMethod: String,
  notes: String,
  createdAt: { type: Date, default: Date.now }
});

const attendanceSchema = new mongoose.Schema({
  memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Member' },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
  checkInTime: { type: Date, default: Date.now },
  checkOutTime: Date,
  duration: Number, // in minutes
  createdAt: { type: Date, default: Date.now }
});

// Models
const Branch = mongoose.model('Branch', branchSchema);
const Member = mongoose.model('Member', memberSchema);
const Payment = mongoose.model('Payment', paymentSchema);
const Attendance = mongoose.model('Attendance', attendanceSchema);

// Routes

// Dashboard Analytics
app.get('/api/dashboard', async (req, res) => {
  try {
    const currentMonth = new Date().toISOString().substr(0, 7);
    const currentYear = new Date().getFullYear();
    
    // Total revenue this month
    const currentMonthRevenue = await Payment.aggregate([
      { $match: { paymentMonth: currentMonth, paymentStatus: 'paid' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    
    // Pending payments this month
    const pendingPayments = await Payment.aggregate([
      { $match: { paymentMonth: currentMonth, paymentStatus: 'pending' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    
    // Monthly revenue trend
    const monthlyRevenue = await Payment.aggregate([
      { $match: { paymentStatus: 'paid' } },
      { $group: { 
        _id: '$paymentMonth', 
        revenue: { $sum: '$amount' },
        count: { $sum: 1 }
      }},
      { $sort: { _id: 1 } },
      { $limit: 12 }
    ]);
    
    // Branch wise members
    const branchMembers = await Member.aggregate([
      { $lookup: { from: 'branches', localField: 'branchId', foreignField: '_id', as: 'branch' } },
      { $unwind: '$branch' },
      { $group: { 
        _id: '$branchId', 
        branchName: { $first: '$branch.name' },
        totalMembers: { $sum: 1 },
        activeMembers: { $sum: { $cond: ['$isActive', 1, 0] } }
      }}
    ]);
    
    // Today's attendance
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayAttendance = await Attendance.countDocuments({
      createdAt: { $gte: today }
    });
    
    // Total active members
    const totalActiveMembers = await Member.countDocuments({ isActive: true });
    
    res.json({
      currentMonthRevenue: currentMonthRevenue[0]?.total || 0,
      pendingPayments: pendingPayments[0]?.total || 0,
      monthlyRevenue,
      branchMembers,
      todayAttendance,
      totalActiveMembers
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Branch routes
app.get('/api/branches', async (req, res) => {
  try {
    const branches = await Branch.find();
    res.json(branches);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/branches', async (req, res) => {
  try {
    const branch = new Branch(req.body);
    await branch.save();
    res.status(201).json(branch);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Member routes
app.get('/api/members', async (req, res) => {
  try {
    const { branchId, status } = req.query;
    let query = {};
    
    if (branchId) query.branchId = branchId;
    if (status) query.isActive = status === 'active';
    
    const members = await Member.find(query).populate('branchId', 'name location');
    res.json(members);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/members', async (req, res) => {
  try {
    const member = new Member(req.body);
    await member.save();
    res.status(201).json(member);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/members/:id/status', async (req, res) => {
  try {
    const { isActive } = req.body;
    const member = await Member.findByIdAndUpdate(
      req.params.id,
      { isActive },
      { new: true }
    );
    res.json(member);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Payment routes
app.get('/api/payments', async (req, res) => {
  try {
    const { branchId, status, month } = req.query;
    let query = {};
    
    if (branchId) query.branchId = branchId;
    if (status) query.paymentStatus = status;
    if (month) query.paymentMonth = month;
    
    const payments = await Payment.find(query)
      .populate('memberId', 'name email phone')
      .populate('branchId', 'name location')
      .sort({ createdAt: -1 });
    res.json(payments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/payments', async (req, res) => {
  try {
    const payment = new Payment(req.body);
    await payment.save();
    res.status(201).json(payment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/payments/:id/status', async (req, res) => {
  try {
    const { paymentStatus } = req.body;
    const payment = await Payment.findByIdAndUpdate(
      req.params.id,
      { paymentStatus },
      { new: true }
    );
    res.json(payment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Attendance routes
app.get('/api/attendance', async (req, res) => {
  try {
    const { branchId, date } = req.query;
    let query = {};
    
    if (branchId) query.branchId = branchId;
    if (date) {
      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 1);
      query.createdAt = { $gte: startDate, $lt: endDate };
    }
    
    const attendance = await Attendance.find(query)
      .populate('memberId', 'name email phone')
      .populate('branchId', 'name location')
      .sort({ createdAt: -1 });
    res.json(attendance);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/attendance/checkin', async (req, res) => {
  try {
    const { memberId, branchId } = req.body;
    
    // Check if member already checked in today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const existingAttendance = await Attendance.findOne({
      memberId,
      createdAt: { $gte: today },
      checkOutTime: { $exists: false }
    });
    
    if (existingAttendance) {
      return res.status(400).json({ error: 'Member already checked in today' });
    }
    
    const attendance = new Attendance({ memberId, branchId });
    await attendance.save();
    res.status(201).json(attendance);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/attendance/:id/checkout', async (req, res) => {
  try {
    const checkOutTime = new Date();
    const attendance = await Attendance.findById(req.params.id);
    
    if (!attendance) {
      return res.status(404).json({ error: 'Attendance record not found' });
    }
    
    const duration = Math.floor((checkOutTime - attendance.checkInTime) / (1000 * 60));
    
    attendance.checkOutTime = checkOutTime;
    attendance.duration = duration;
    await attendance.save();
    
    res.json(attendance);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Initialize sample data
async function initializeSampleData() {
  try {
    const branchCount = await Branch.countDocuments();
    if (branchCount === 0) {
      const branches = await Branch.insertMany([
        { name: 'Downtown Branch', location: '123 Main St', contact: '+1234567890' },
        { name: 'Westside Branch', location: '456 West Ave', contact: '+1234567891' },
        { name: 'Eastside Branch', location: '789 East Blvd', contact: '+1234567892' },
        { name: 'Northside Branch', location: '321 North Rd', contact: '+1234567893' }
      ]);
      
      console.log('Sample branches created');
    }
  } catch (error) {
    console.error('Error initializing sample data:', error);
  }
}

// Initialize sample data on server start
setTimeout(initializeSampleData, 1000);