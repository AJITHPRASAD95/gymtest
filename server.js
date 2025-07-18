const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000; // Use environment variable for PORT

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// MongoDB connection
// Use process.env.MONGODB_URI for MongoDB Atlas connection string
// Fallback to local connection for development if MONGODB_URI is not set
mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://ajithtest95:ajith%40123@cluster0.n3qvh.mongodb.net/blackswan_laundry?retryWrites=true&w=majority', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected successfully!'))
.catch(err => console.error('MongoDB connection error:', err));

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
  createdAt: { type: Date, default: Date.now },
  role: { type: String, enum: ['user', 'admin'], default: 'user' } // Added role for Flutter app
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

// New Workout Schema for Flutter app
const workoutSchema = new mongoose.Schema({
  memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },
  activity: { type: String, required: true },
  durationMinutes: { type: Number, required: true },
  caloriesBurned: { type: Number, required: true },
  workoutDate: { type: Date, default: Date.now },
  notes: String,
  createdAt: { type: Date, default: Date.now }
});


// Models
const Branch = mongoose.model('Branch', branchSchema);
const Member = mongoose.model('Member', memberSchema);
const Payment = mongoose.model('Payment', paymentSchema);
const Attendance = mongoose.model('Attendance', attendanceSchema);
const Workout = mongoose.model('Workout', workoutSchema); // New Workout Model

// Routes

// Dashboard Analytics
app.get('/api/dashboard', async (req, res) => {
  try {
    const { month, branchId } = req.query; // Get month and branchId from query
    
    // Base match for payments and attendance
    let paymentMatch = { paymentStatus: 'paid' };
    let pendingPaymentMatch = { paymentStatus: 'pending' };
    let attendanceMatch = {};
    let memberMatch = {};

    if (month) {
      paymentMatch.paymentMonth = month;
      pendingPaymentMatch.paymentMonth = month;
    }
    if (branchId) {
      paymentMatch.branchId = new mongoose.Types.ObjectId(branchId);
      pendingPaymentMatch.branchId = new mongoose.Types.ObjectId(branchId);
      attendanceMatch.branchId = new mongoose.Types.ObjectId(branchId);
      memberMatch.branchId = new mongoose.Types.ObjectId(branchId);
    }

    // Total revenue this month (filtered by month and branch)
    const currentMonthRevenue = await Payment.aggregate([
      { $match: paymentMatch },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    
    // Pending payments this month (filtered by month and branch)
    const pendingPayments = await Payment.aggregate([
      { $match: pendingPaymentMatch },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    
    // Monthly revenue trend (filtered by branch)
    let monthlyRevenuePipeline = [
      { $match: { paymentStatus: 'paid' } },
    ];
    if (branchId) {
      monthlyRevenuePipeline.push({ $match: { branchId: new mongoose.Types.ObjectId(branchId) } });
    }
    monthlyRevenuePipeline.push(
      { $group: { 
        _id: '$paymentMonth', 
        revenue: { $sum: '$amount' },
        count: { $sum: 1 }
      }},
      { $sort: { _id: 1 } },
      { $limit: 12 } // Limit to last 12 months for trend
    );
    const monthlyRevenue = await Payment.aggregate(monthlyRevenuePipeline);

    // Branch wise members (not filtered by month, but can be filtered by branch if branchId is provided)
    let branchMembersPipeline = [];
    if (branchId) {
        branchMembersPipeline.push({ $match: { _id: new mongoose.Types.ObjectId(branchId) } });
    }
    branchMembersPipeline.push(
        { $lookup: { from: 'members', localField: '_id', foreignField: 'branchId', as: 'members' } },
        { $unwind: { path: '$members', preserveNullAndEmptyArrays: true } }, // Use preserveNullAndEmptyArrays to include branches with no members
        { $group: {
            _id: '$_id',
            branchName: { $first: '$name' },
            totalMembers: { $sum: { $cond: ['$members', 1, 0] } }, // Count members only if they exist
            activeMembers: { $sum: { $cond: [{ $and: ['$members', '$members.isActive'] }, 1, 0] } }
        }},
        { $sort: { branchName: 1 } }
    );
    const branchMembers = await Branch.aggregate(branchMembersPipeline);

    // Today's attendance (filtered by branch)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    attendanceMatch.createdAt = { $gte: today };
    const todayAttendance = await Attendance.countDocuments(attendanceMatch);
    
    // Total active members (filtered by branch)
    memberMatch.isActive = true;
    const totalActiveMembers = await Member.countDocuments(memberMatch);
    
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
    const { branchId, status, email } = req.query; // Added email for login
    let query = {};
    
    if (branchId) query.branchId = branchId;
    if (status) query.isActive = status === 'active';
    if (email) query.email = email; // Filter by email for login

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
    const { branchId, status, month, memberName } = req.query; // Added memberName
    let query = {};
    
    if (branchId) query.branchId = branchId;
    if (status) query.paymentStatus = status;
    if (month) query.paymentMonth = month;

    // New: Filter by member name
    if (memberName) {
      const members = await Member.find({ name: { $regex: memberName, $options: 'i' } }).select('_id');
      const memberIds = members.map(member => member._id);
      query.memberId = { $in: memberIds };
    }
    
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
    const { memberId, branchId, date } = req.query; // Added memberId filter
    let query = {};
    
    if (memberId) query.memberId = memberId; // Filter by memberId
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

// --- Workout Routes (Added for Flutter app) ---

// Get all workouts (can filter by memberId)
app.get('/api/workouts', async (req, res) => {
  try {
    const { memberId } = req.query;
    let query = {};
    if (memberId) {
      query.memberId = memberId;
    }
    const workouts = await Workout.find(query)
      .populate('memberId', 'name email') // Populate member details
      .sort({ workoutDate: -1, createdAt: -1 });
    res.json(workouts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add a new workout
app.post('/api/workouts', async (req, res) => {
  try {
    const workout = new Workout(req.body);
    await workout.save();
    res.status(201).json(workout);
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

    // Add a sample admin user if none exists
    const adminCount = await Member.countDocuments({ role: 'admin' });
    if (adminCount === 0) {
      const branches = await Branch.find();
      if (branches.length > 0) {
        await Member.create({
          name: 'Admin User',
          email: 'admin@example.com',
          phone: '9998887770',
          branchId: branches[0]._id,
          membershipType: 'vip',
          joinDate: new Date(),
          isActive: true,
          monthlyFee: 5000,
          emergencyContact: '9998887771',
          role: 'admin'
        });
        console.log('Sample admin user created');
      }
    }

  } catch (error) {
    console.error('Error initializing sample data:', error);
  }
}

// Initialize sample data on server start
setTimeout(initializeSampleData, 1000);
