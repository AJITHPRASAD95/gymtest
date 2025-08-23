
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serves static files from the 'public' directory

// MongoDB Atlas connection string
// IMPORTANT: In a production environment, store this connection string securely (e.g., in environment variables)
const mongoAtlasUri = 'mongodb+srv://ajithtest95:ajith%40123@cluster0.n3qvh.mongodb.net/gym_management?retryWrites=true&w=majority';

// MongoDB Connection - NOW USING ATLAS URI
mongoose.connect(mongoAtlasUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB Atlas Connected Successfully!')) // Confirmation message
.catch(err => console.error('MongoDB Atlas connection error:', err)); // Error handling for connection


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
  fingerprintId: { type: Number, unique: true, sparse: true }, // NEW: Fingerprint ID (1-999), unique and optional
  createdAt: { type: Date, default: Date.now }
});

const paymentSchema = new mongoose.Schema({
  memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Member' },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
  amount: Number,
  paymentDate: { type: Date }, // No default, set when paid
  paymentMonth: String, // Format: "YYYY-MM"
  paymentStatus: { type: String, enum: ['paid', 'pending', 'overdue', 'non_payable'], default: 'pending' },
  paymentMethod: String, // NEW: Field for UPI, Cash, etc.
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

// NEW: Expense Schema
const expenseSchema = new mongoose.Schema({
  reason: { type: String, required: true },
  amount: { type: Number, required: true },
  date: { type: Date, default: Date.now },
  branchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: false // Expenses can be branch-specific or general (admin)
  },
  createdAt: { type: Date, default: Date.now }
});

// User Schema for authentication and roles
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true }, // In a real app, hash this password (e.g., with bcrypt)
  role: { type: String, enum: ['admin', 'manager'], required: true }, // 'admin' for full access, 'manager' for branch-specific
  branchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: function() { return this.role === 'manager'; } // Managers must be associated with a branch
  }
});


// Models
const Branch = mongoose.model('Branch', branchSchema);
const Member = mongoose.model('Member', memberSchema);
const Payment = mongoose.model('Payment', paymentSchema);
const Attendance = mongoose.model('Attendance', attendanceSchema);
const User = mongoose.model('User', userSchema); // User Model
const Expense = mongoose.model('Expense', expenseSchema); // NEW: Expense Model


// Authentication Middleware
// This middleware simulates authentication by checking custom headers
// In a real application, this would involve JWTs or session management
const authenticateUser = (req, res, next) => {
  // Allow the login route to proceed without authentication headers
  if (req.path === '/api/login') {
    return next();
  }

  // For all other routes, expect user info in headers
  const username = req.headers['x-username'];
  const role = req.headers['x-role'];
  const branchId = req.headers['x-branch-id'];

  if (username && role) {
    req.user = {
      username: username,
      role: role,
      branchId: branchId || null // Branch ID is optional for admin, required for manager
    };
    return next();
  }

  // If no authentication headers are present, deny access
  return res.status(401).json({ message: 'Authentication required' });
};

// Authorization Middleware
// This middleware checks if the authenticated user has the required role(s)
const authorizeUser = (roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ message: 'Forbidden: Insufficient permissions' });
  }
  next();
};

app.use(authenticateUser); // Apply authentication middleware to all routes (except /api/login)

// Login Route (Simplified for demonstration)
// In a real app, you'd use bcrypt for password hashing and generate a JWT
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });
    // Simple password comparison (DO NOT use in production)
    if (!user || user.password !== password) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    // Return user role and branchId for frontend to store
    res.json({
      message: 'Login successful',
      user: {
        username: user.username,
        role: user.role,
        branchId: user.branchId ? user.branchId.toString() : null // Convert ObjectId to string
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add new member API endpoint
app.post('/api/members', authorizeUser(['admin', 'manager']), async (req, res) => {
  try {
    const { memberData, admissionFee, paymentMethod, firstPaymentMonth } = req.body;
    
    // Validate required fields
    if (!memberData?.name || !memberData?.branchId || !memberData?.membershipType || 
        !memberData?.monthlyFee || !admissionFee || !paymentMethod || !firstPaymentMonth) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Create member
    const member = new Member(memberData);
    await member.save();

    // Create admission fee payment
    const admissionPayment = new Payment({
      memberId: member._id,
      branchId: member.branchId,
      amount: admissionFee,
      paymentDate: new Date(),
      paymentMonth: firstPaymentMonth === 'current' ? 
        `${new Date().getFullYear()}-${(new Date().getMonth() + 1).toString().padStart(2, '0')}` :
        `${new Date().getFullYear()}-${(new Date().getMonth() + 2).toString().padStart(2, '0')}`,
      paymentStatus: 'paid',
      paymentMethod: paymentMethod,
      notes: 'Admission fee'
    });
    await admissionPayment.save();

    // Create first monthly payment (status depends on firstPaymentMonth)
    const monthlyPayment = new Payment({
      memberId: member._id,
      branchId: member.branchId,
      amount: memberData.monthlyFee,
      paymentMonth: firstPaymentMonth === 'current' ? 
        `${new Date().getFullYear()}-${(new Date().getMonth() + 1).toString().padStart(2, '0')}` :
        `${new Date().getFullYear()}-${(new Date().getMonth() + 2).toString().padStart(2, '0')}`,
      paymentStatus: firstPaymentMonth === 'current' ? 'paid' : 'pending',
      paymentMethod: firstPaymentMonth === 'current' ? paymentMethod : undefined,
      notes: 'Monthly membership fee'
    });
    await monthlyPayment.save();

    res.status(201).json(member);
  } catch (error) {
    console.error('Error adding member:', error);
    res.status(500).json({ error: 'Server error' });
  }
});
// Dashboard Analytics - PROTECTED
// Admins can see all, managers only their branch
app.get('/api/dashboard', authorizeUser(['admin', 'manager']), async (req, res) => {
  try {
    const { month, branchId } = req.query;
    const userRole = req.user.role;
    const userBranchId = req.user.branchId;

    // Base match criteria for various aggregations
    let currentMonthRevenueMatch = { paymentStatus: 'paid' };
    let pendingPaymentMatch = { paymentStatus: 'pending' };
    let monthlyRevenuePipelineMatch = { paymentStatus: 'paid' };
    let attendanceMatch = {};
    let memberMatch = {};
    let todayNewMembersMatch = {};
    let branchMemberAggregateMatch = {};
    let expenseMatch = {}; // NEW: Expense match criteria

    // Apply branch filtering based on user role
    if (userRole === 'manager' && userBranchId) {
        currentMonthRevenueMatch.branchId = new mongoose.Types.ObjectId(userBranchId);
        pendingPaymentMatch.branchId = new mongoose.Types.ObjectId(userBranchId);
        attendanceMatch.branchId = new mongoose.Types.ObjectId(userBranchId);
        memberMatch.branchId = new mongoose.Types.ObjectId(userBranchId);
        todayNewMembersMatch.branchId = new mongoose.Types.ObjectId(userBranchId);
        branchMemberAggregateMatch._id = new mongoose.Types.ObjectId(userBranchId);
        monthlyRevenuePipelineMatch.branchId = new mongoose.Types.ObjectId(userBranchId);
        expenseMatch.branchId = new mongoose.Types.ObjectId(userBranchId); // NEW
    } else if (branchId) {
        currentMonthRevenueMatch.branchId = new mongoose.Types.ObjectId(branchId);
        pendingPaymentMatch.branchId = new mongoose.Types.ObjectId(branchId);
        attendanceMatch.branchId = new mongoose.Types.ObjectId(branchId);
        memberMatch.branchId = new mongoose.Types.ObjectId(branchId);
        todayNewMembersMatch.branchId = new mongoose.Types.ObjectId(branchId);
        branchMemberAggregateMatch._id = new mongoose.Types.ObjectId(branchId);
        monthlyRevenuePipelineMatch.branchId = new mongoose.Types.ObjectId(branchId);
        expenseMatch.branchId = new mongoose.Types.ObjectId(branchId); // NEW
    }

    // Apply month filtering if provided
    if (month) {
      currentMonthRevenueMatch.paymentMonth = month;
      pendingPaymentMatch.paymentMonth = month;

      // NEW: Add date filtering for expenses based on month
      const [year, monthNum] = month.split('-');
      const startDate = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
      const endDate = new Date(parseInt(year), parseInt(monthNum), 0); // Last day of the month
      expenseMatch.date = { $gte: startDate, $lte: endDate };
    }


    // Calculate Current Month Revenue
    const currentMonthRevenueResult = await Payment.aggregate([
      { $match: currentMonthRevenueMatch },
      { $group: {
          _id: null,
          total: { $sum: '$amount' },
          totalUPI: { $sum: { $cond: [{ $eq: ['$paymentMethod', 'UPI'] }, '$amount', 0] } }, // NEW
          totalCash: { $sum: { $cond: [{ $eq: ['$paymentMethod', 'Cash'] }, '$amount', 0] } } // NEW
      }}
    ]);
    const totalRevenue = currentMonthRevenueResult.length > 0 ? currentMonthRevenueResult[0].total : 0;
    const totalRevenueUPI = currentMonthRevenueResult.length > 0 ? currentMonthRevenueResult[0].totalUPI : 0; // NEW
    const totalRevenueCash = currentMonthRevenueResult.length > 0 ? currentMonthRevenueResult[0].totalCash : 0; // NEW


    // Calculate Pending Payments
    const pendingPayments = await Payment.aggregate([
      { $match: pendingPaymentMatch },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    // NEW: Calculate Total Expenses for the current month
    const totalExpensesResult = await Expense.aggregate([
      { $match: expenseMatch },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const totalExpenses = totalExpensesResult.length > 0 ? totalExpensesResult[0].total : 0;

    // NEW: Calculate Net Revenue
    const netRevenue = totalRevenue - totalExpenses;

    // Calculate Monthly Revenue Trend
    let monthlyRevenuePipeline = [
      { $match: monthlyRevenuePipelineMatch },
    ];
    if (userRole === 'manager' && userBranchId) {
        monthlyRevenuePipeline.push({ $match: { branchId: new mongoose.Types.ObjectId(userBranchId) } });
    } else if (branchId) {
      monthlyRevenuePipeline.push({ $match: { branchId: new mongoose.Types.ObjectId(branchId) } });
    }
    monthlyRevenuePipeline.push(
      { $group: {
        _id: '$paymentMonth',
        revenue: { $sum: '$amount' },
        count: { $sum: 1 }
      }},
      { $sort: { _id: 1 } },
      { $limit: 12 }
    );
    const monthlyRevenue = await Payment.aggregate(monthlyRevenuePipeline);

    // Calculate Branch-wise Members
    let branchMembersPipeline = [];
    if (Object.keys(branchMemberAggregateMatch).length > 0) {
        branchMembersPipeline.push({ $match: branchMemberAggregateMatch });
    }
    branchMembersPipeline.push(
        { $lookup: { from: 'members', localField: '_id', foreignField: 'branchId', as: 'members' } },
        { $unwind: { path: '$members', preserveNullAndEmptyArrays: true } },
        { $group: {
            _id: '$_id',
            branchName: { $first: '$name' },
            totalMembers: { $sum: { $cond: ['$members', 1, 0] } },
            activeMembers: { $sum: { $cond: [{ $and: ['$members', '$members.isActive'] }, 1, 0] } }
        }},
        { $sort: { branchName: 1 } }
    );
    const branchMembers = await Branch.aggregate(branchMembersPipeline);

    // Calculate Today's Attendance
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    attendanceMatch.createdAt = { $gte: today };
    const todayAttendance = await Attendance.countDocuments(attendanceMatch);

    // Calculate Total Active Members
    memberMatch.isActive = true;
    const totalActiveMembers = await Member.countDocuments(memberMatch);

    // Calculate Today's New Members
    todayNewMembersMatch.joinDate = { $gte: today };
    const todayNewMembers = await Member.countDocuments(todayNewMembersMatch);

    res.json({
      totalRevenue: totalRevenue,
      totalPendingPayments: pendingPayments.length > 0 ? pendingPayments[0].total : 0,
      monthlyRevenue: monthlyRevenue,
      branchMembers: branchMembers,
      todayAttendance: todayAttendance,
      totalActiveMembers: totalActiveMembers,
      todayNewMembers: todayNewMembers,
      totalExpenses: totalExpenses, // NEW
      netRevenue: netRevenue,       // NEW
      totalRevenueUPI: totalRevenueUPI, // NEW
      totalRevenueCash: totalRevenueCash // NEW
    });

  } catch (error) {
    console.error('Error in dashboard GET API:', error);
    res.status(500).json({ error: error.message });
  }
});


// Branch Routes - PROTECTED (Admin only for creation/deletion, manager can view)
// Get all branches - PROTECTED (Admin and Manager can view)
app.get('/api/branches', authorizeUser(['admin', 'manager']), async (req, res) => {
  try {
    const userRole = req.user.role;
    const userBranchId = req.user.branchId;
    let query = {};
    if (userRole === 'manager' && userBranchId) {
      query._id = userBranchId; // Managers can only see their own branch
    }
    const branches = await Branch.find(query);

    res.json(branches);
  } catch (error) {
    console.error('Error in branches GET API:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add new branch - PROTECTED (Admin only)
app.post('/api/branches', authorizeUser(['admin']), async (req, res) => {
  try {
    const branch = new Branch(req.body);
    await branch.save();
    res.status(201).json(branch);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update branch - PROTECTED (Admin only)
app.put('/api/branches/:id', authorizeUser(['admin']), async (req, res) => {
  try {
    const branch = await Branch.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!branch) {
      return res.status(404).json({ error: 'Branch not found' });
    }
    res.json(branch);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete branch - PROTECTED (Admin only)
app.delete('/api/branches/:id', authorizeUser(['admin']), async (req, res) => {
  try {
    const branch = await Branch.findByIdAndDelete(req.params.id);
    if (!branch) {
      return res.status(404).json({ error: 'Branch not found' });
    }
    res.status(204).send(); // No content for successful deletion
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// Member Routes - PROTECTED
// Get all members - PROTECTED (Admins can view all, Managers view their branch)
app.get('/api/members', authorizeUser(['admin', 'manager']), async (req, res) => {
  try {
    const { branchId, status, name } = req.query;
    const userRole = req.user.role;
    const userBranchId = req.user.branchId;
    let query = {};

    if (userRole === 'manager' && userBranchId) {
      query.branchId = userBranchId; // Managers can only see members from their branch
    } else if (branchId) {
      query.branchId = branchId; // Admins can filter by any branch
    }

    if (status) query.isActive = status === 'active';
    if (name) {
      query.name = { $regex: name, $options: 'i' }; // Case-insensitive regex search
    }

    const members = await Member.find(query).populate('branchId', 'name location');
    res.json(members);
  } catch (error) {
    console.error('Error in members GET API:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get a single member by ID - PROTECTED
app.get('/api/members/:id', authorizeUser(['admin', 'manager']), async (req, res) => {
  try {
    const userRole = req.user.role;
    const userBranchId = req.user.branchId;
    const member = await Member.findById(req.params.id).populate('branchId', 'name location');
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }
    // Managers can only access members in their own branch
    if (userRole === 'manager' && userBranchId && member.branchId.toString() !== userBranchId.toString()) {
      return res.status(403).json({ message: 'Forbidden: You can only access members in your assigned branch' });
    }
    res.json(member);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// Edit Member Details - PROTECTED (Admins and Managers)
app.put('/api/members/:id', authorizeUser(['admin', 'manager']), async (req, res) => {
  try {
    const userRole = req.user.role;
    const userBranchId = req.u
    ser.branchId;
    const memberId = req.params.id;
    const updateData = req.body;

    const memberToUpdate = await Member.findById(memberId);
    if (!memberToUpdate) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Managers can only update members in their own branch
    if (userRole === 'manager' && userBranchId && memberToUpdate.branchId.toString() !== userBranchId.toString()) {
      return res.status(403).json({ message: 'Forbidden: You can only update members in your assigned branch' });
    }
    // Prevent managers from changing branchId
    if (userRole === 'manager' && updateData.branchId && updateData.branchId !== memberToUpdate.branchId.toString()) {
      return res.status(403).json({ message: 'Forbidden: Managers cannot change a member\'s branch.' });
    }
    // Admin must provide branchId if changing it
    if (userRole === 'admin' && updateData.branchId && !mongoose.Types.ObjectId.isValid(updateData.branchId)) {
      return res.status(400).json({ message: 'Invalid Branch ID provided.' });
    }


    const member = await Member.findByIdAndUpdate(memberId, updateData, { new: true });
    res.json(member);
  } catch (error) {
    console.error('Error in members PUT API:', error);
    res.status(500).json({ error: error.message });
  }
});

// Toggle Member Status (Active/Inactive) - PROTECTED (Admins and Managers)
app.put('/api/members/:id/toggle-status', authorizeUser(['admin', 'manager']), async (req, res) => {
  try {
    const userRole = req.user.role;
    const userBranchId = req.user.branchId;
    const memberId = req.params.id;
    const { isActive } = req.body; // Expect `isActive` boolean in body

    const memberToUpdate = await Member.findById(memberId);
    if (!memberToUpdate) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Managers can only update members in their own branch
    if (userRole === 'manager' && userBranchId && memberToUpdate.branchId.toString() !== userBranchId.toString()) {
      return res.status(403).json({ message: 'Forbidden: You can only update members in your assigned branch' });
    }

    const member = await Member.findByIdAndUpdate(
      memberId,
      { isActive },
      { new: true }
    );

    // NEW LOGIC: Update payment status based on member's active status
    if (isActive === false) {
      // If member is made inactive, mark all their pending/overdue payments as non_payable
      await Payment.updateMany(
        { memberId: memberId, paymentStatus: { $in: ['pending', 'overdue'] } },
        { $set: { paymentStatus: 'non_payable' } }
      );
      console.log(`Member ${member.name} made inactive. Associated pending/overdue payments marked as non_payable.`);
    } else {
      // If member is made active, revert any non_payable payments back to pending
      await Payment.updateMany(
        { memberId: memberId, paymentStatus: 'non_payable' },
        { $set: { paymentStatus: 'pending' } }
      );
      console.log(`Member ${member.name} made active. Associated non_payable payments reverted to pending.`);
    }

    res.json(member); // Return the updated member
  } catch (error) {
    console.error('Error toggling member status:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete member - PROTECTED (Admins only)
app.delete('/api/members/:id', authorizeUser(['admin']), async (req, res) => {
  try {
    const member = await Member.findByIdAndDelete(req.params.id);
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }
    // Also delete associated payments and attendance records
    await Payment.deleteMany({ memberId: req.params.id });
    await Attendance.deleteMany({ memberId: req.params.id });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// Payment Routes - PROTECTED
// Get all payments - PROTECTED (Admins can view all, Managers view their branch)
// Get all payments - PROTECTED (Admins can view all, Managers view their branch)
app.get('/api/payments', authorizeUser(['admin', 'manager']), async (req, res) => {
  try {
    const { branchId, status, memberName } = req.query;
    const userRole = req.user.role;
    const userBranchId = req.user.branchId;
    let query = {};

    if (userRole === 'manager' && userBranchId) {
      query.branchId = userBranchId;
    } else if (branchId) {
      query.branchId = branchId;
    }

    if (status) query.paymentStatus = status;

    if (memberName) {
      const members = await Member.find({ name: { $regex: memberName, $options: 'i' } }).select('_id');
      const memberIds = members.map(m => m._id);
      query.memberId = { $in: memberIds };
    }

    // MODIFIED: Include 'phone' in the populate for memberId
    const payments = await Payment.find(query)
      .populate('memberId', 'name email phone') // Added 'phone' here
      .populate('branchId', 'name location')
      .sort({ paymentDate: -1 });
    res.json(payments);
  } catch (error) {
    console.error('Error in payments GET API:', error);
    res.status(500).json({ error: error.message });
  }
});
// Add a new payment (e.g., for a new member's first payment) - PROTECTED (Admins and Managers)
app.post('/api/payments', authorizeUser(['admin', 'manager']), async (req, res) => {
  try {
    const paymentData = req.body;
    const userRole = req.user.role;
    const userBranchId = req.user.branchId;

    // Fetch member to get their branchId if not provided in payload
    const member = await Member.findById(paymentData.memberId);
    if (!member) {
      return res.status(404).json({ message: 'Member not found.' });
    }

    // Managers can only add payments for members in their assigned branch
    if (userRole === 'manager' && userBranchId && member.branchId.toString() !== userBranchId.toString()) {
      return res.status(403).json({ message: 'Forbidden: You can only add payments for members in your assigned branch.' });
    }
    // Set branchId from member's branch
    paymentData.branchId = member.branchId;

    // If payment is marked as 'paid' at creation, set paymentDate
    if (paymentData.paymentStatus === 'paid' && !paymentData.paymentDate) {
        paymentData.paymentDate = Date.now();
    }

    const payment = new Payment(paymentData);
    await payment.save();
    res.status(201).json(payment);
  } catch (error) {
    console.error('Error in payments POST API:', error);
    res.status(500).json({ error: error.message });
  }
});

// Admins and managers can update payment status, but managers are restricted to their branch
app.put('/api/payments/:id/status', authorizeUser(['admin', 'manager']), async (req, res) => {
  try {
    const { paymentStatus, paymentMethod } = req.body; // NEW: Added paymentMethod
    const userRole = req.user.role;
    const userBranchId = req.user.branchId;

    const paymentToUpdate = await Payment.findById(req.params.id);
    if (!paymentToUpdate) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    // Managers can only update payments in their own branch
    if (userRole === 'manager' && userBranchId && paymentToUpdate.branchId.toString() !== userBranchId.toString()) {
      return res.status(403).json({ message: 'Forbidden: You can only update payments in your assigned branch' });
    }

    // Update paymentStatus and conditionally update paymentDate and paymentMethod
    paymentToUpdate.paymentStatus = paymentStatus;
    if (paymentStatus === 'paid') {
      paymentToUpdate.paymentDate = Date.now(); // Set paymentDate to now if status is 'paid'
      paymentToUpdate.paymentMethod = paymentMethod; // Set payment method
    } else if (paymentStatus === 'pending' || paymentStatus === 'overdue' || paymentStatus === 'non_payable') {
        paymentToUpdate.paymentDate = undefined; // Clear paymentDate if not paid
        paymentToUpdate.paymentMethod = undefined; // Clear payment method
    }

    await paymentToUpdate.save();
    res.json(paymentToUpdate);
  } catch (error) {
    console.error('Error updating payment status:', error);
    res.status(500).json({ error: error.message });
  }
});

// Bulk update payment statuses - PROTECTED (Admins and Managers)
// Bulk update payment statuses - PROTECTED (Admins and Managers)
app.post('/api/payments/bulk-update-status', authorizeUser(['admin', 'manager']), async (req, res) => {
  try {
    const { month, newStatus, memberIdsToInclude, memberIdsToExclude } = req.body;
    const userRole = req.user.role;
    const userBranchId = req.user.branchId;

    if (!month || !newStatus || !['paid', 'pending', 'non_payable'].includes(newStatus)) {
      return res.status(400).json({ message: 'Month and valid newStatus (paid, pending, non_payable) are required.' });
    }

    let memberQuery = {};
    // Apply branch filtering for managers
    if (userRole === 'manager' && userBranchId) {
      memberQuery.branchId = userBranchId;
    }

    let membersToProcess;
    if (memberIdsToInclude && memberIdsToInclude.length > 0) {
      memberQuery._id = { $in: memberIdsToInclude };
      membersToProcess = await Member.find(memberQuery);
    } else {
      membersToProcess = await Member.find(memberQuery);
      if (memberIdsToExclude && memberIdsToExclude.length > 0) {
        membersToProcess = membersToProcess.filter(member => !memberIdsToExclude.includes(member._id.toString()));
      }
    }

    const memberIds = membersToProcess.map(m => m._id);

    // Perform the bulk update
    const updateResult = await Payment.updateMany(
      {
        memberId: { $in: memberIds },
        paymentMonth: month
      },
      {
        $set: {
          paymentStatus: newStatus,
          paymentDate: newStatus === 'paid' ? Date.now() : undefined,
          paymentMethod: newStatus === 'paid' ? 'Bulk Update' : undefined,
        }
      }
    );

    res.json({ message: `${updateResult.modifiedCount} payments updated successfully.`, updateResult });

  } catch (error) {
    console.error('Error in bulk payment update:', error);
    res.status(500).json({ error: error.message });
  }
});
// Delete payment - PROTECTED (Admins only)
app.delete('/api/payments/:id', authorizeUser(['admin']), async (req, res) => {
  try {
    const payment = await Payment.findByIdAndDelete(req.params.id);
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// Attendance Routes - PROTECTED
// Get all attendance records - PROTECTED (Admins can view all, Managers view their branch)
app.get('/api/attendance', authorizeUser(['admin', 'manager']), async (req, res) => {
  try {
    const { branchId, date, memberName } = req.query;
    const userRole = req.user.role;
    const userBranchId = req.user.branchId;
    let query = {};

    if (userRole === 'manager' && userBranchId) {
      query.branchId = userBranchId;
    } else if (branchId) {
      query.branchId = branchId;
    }

    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      query.checkInTime = { $gte: startOfDay, $lte: endOfDay };
    }

    if (memberName) {
      const members = await Member.find({ name: { $regex: memberName, $options: 'i' } }).select('_id');
      const memberIds = members.map(m => m._id);
      query.memberId = { $in: memberIds };
    }

    const attendance = await Attendance.find(query)
      .populate('memberId', 'name email')
      .populate('branchId', 'name location')
      .sort({ checkInTime: -1 });
    res.json(attendance);
  } catch (error) {
    console.error('Error in attendance GET API:', error);
    res.status(500).json({ error: error.message });
  }
});

// NEW: Get attendance for a specific member - PROTECTED
app.get('/api/members/:memberId/attendance', authorizeUser(['admin', 'manager']), async (req, res) => {
  try {
    const { memberId } = req.params;
    const userRole = req.user.role;
    const userBranchId = req.user.branchId;

    const member = await Member.findById(memberId);
    if (!member) {
      return res.status(404).json({ message: 'Member not found' });
    }
    // Managers can only view attendance for members in their own branch
    if (userRole === 'manager' && userBranchId && member.branchId.toString() !== userBranchId.toString()) {
      return res.status(403).json({ message: 'Forbidden: You can only view attendance for members in your assigned branch' });
    }

    const attendanceRecords = await Attendance.find({ memberId })
      .populate('branchId', 'name location')
      .sort({ checkInTime: -1 }); // Sort by most recent check-in first
    res.json(attendanceRecords);
  } catch (error) {
    console.error('Error in member attendance GET API:', error);
    res.status(500).json({ error: error.message });
  }
});


// Check-in member - PROTECTED (Admins and Managers)
app.post('/api/attendance/checkin', authorizeUser(['admin', 'manager']), async (req, res) => {
  try {
    const { memberId, branchId } = req.body;
    const userRole = req.user.role;
    const userBranchId = req.user.branchId;

    const member = await Member.findById(memberId);
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }
    if (!member.isActive) {
      return res.status(400).json({ error: 'Cannot check in an inactive member.' });
    }

    // Managers can only check-in members from their assigned branch
    if (userRole === 'manager' && userBranchId && member.branchId.toString() !== userBranchId.toString()) {
      return res.status(403).json({ message: 'Forbidden: You can only check-in members in your assigned branch' });
    }

    // Check if member is already checked in (no checkOutTime)
    const existingCheckIn = await Attendance.findOne({ memberId: memberId, checkOutTime: { $exists: false } });
    if (existingCheckIn) {
      return res.status(400).json({ message: 'Member is already checked in.' });
    }

    // Use member's branchId for attendance record, even if branchId is sent in body (for managers)
    const attendance = new Attendance({ memberId, branchId: member.branchId });
    await attendance.save();
    res.status(201).json(attendance);
  } catch (error) {
    console.error('Error in attendance checkin POST API:', error);
    res.status(500).json({ error: error.message });
  }
});

// Admins and managers can check-out members, but managers are restricted to their branch
app.put('/api/attendance/:id/checkout', authorizeUser(['admin', 'manager']), async (req, res) => {
  try {
    const checkOutTime = new Date();
    const userRole = req.user.role;
    const userBranchId = req.user.branchId;

    const attendance = await Attendance.findById(req.params.id).populate('memberId');
    if (!attendance) {
      return res.status(404).json({ error: 'Attendance record not found' });
    }
    if (attendance.checkOutTime) {
      return res.status(400).json({ message: 'Member already checked out.' });
    }

    // Managers can only check-out members from their assigned branch
    if (userRole === 'manager' && userBranchId && attendance.branchId.toString() !== userBranchId.toString()) {
      return res.status(403).json({ message: 'Forbidden: You can only check-out members in your assigned branch' });
    }

    // Calculate duration
    const durationMs = checkOutTime.getTime() - attendance.checkInTime.getTime();
    attendance.duration = Math.round(durationMs / (1000 * 60)); // Duration in minutes

    attendance.checkOutTime = checkOutTime;
    await attendance.save();
    res.json(attendance);
  } catch (error) {
    console.error('Error checking out member:', error);
    res.status(500).json({ error: error.message });
  }
});

// NEW: Expense Routes
// Add a new expense - PROTECTED (Admins and Managers)
app.post('/api/expenses', authorizeUser(['admin', 'manager']), async (req, res) => {
  try {
    const { reason, amount, branchId } = req.body;
    const userRole = req.user.role;
    const userBranchId = req.user.branchId;

    // Managers can only add expenses for their assigned branch
    if (userRole === 'manager' && userBranchId) {
      if (branchId && branchId !== userBranchId) {
        return res.status(403).json({ message: 'Forbidden: Managers can only add expenses for their assigned branch.' });
      }
      req.body.branchId = userBranchId; // Ensure expense is linked to manager's branch
    } else if (userRole === 'admin' && branchId && !mongoose.Types.ObjectId.isValid(branchId)) {
        return res.status(400).json({ message: 'Invalid Branch ID provided for expense.' });
    }

    const expense = new Expense(req.body);
    await expense.save();
    res.status(201).json(expense);
  } catch (error) {
    console.error('Error adding expense:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get expenses - PROTECTED (Admins can view all, Managers view their branch)
app.get('/api/expenses', authorizeUser(['admin', 'manager']), async (req, res) => {
  try {
    const { branchId, month } = req.query;
    const userRole = req.user.role;
    const userBranchId = req.user.branchId;
    let query = {};

    if (userRole === 'manager' && userBranchId) {
      query.branchId = userBranchId;
    } else if (branchId) {
      query.branchId = branchId;
    }

    if (month) {
      const [year, monthNum] = month.split('-');
      const startDate = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
      const endDate = new Date(parseInt(year), parseInt(monthNum), 0);
      query.date = { $gte: startDate, $lte: endDate };
    }

    const expenses = await Expense.find(query).populate('branchId', 'name location').sort({ date: -1 });
    res.json(expenses);
  } catch (error) {
    console.error('Error fetching expenses:', error);
    res.status(500).json({ error: error.message });
  }
});


// Server Start
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  // Optional: Initialize sample data on server start (only if no data exists)
  initializeSampleData();
});

// Sample Data Initialization (Simplified)
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

      // Create sample users for demonstration if they don't exist
      const users = [
        { username: 'admin', password: 'adminpassword', role: 'admin' },
        { username: 'manager_downtown', password: 'managerpassword', role: 'manager', branchId: branches[0]._id },
        { username: 'manager_westside', password: 'managerpassword', role: 'manager', branchId: branches[1]._id }
      ];

      for (const userData of users) {
        const existingUser = await User.findOne({ username: userData.username });
        if (!existingUser) {
          await User.create(userData);
          console.log(`User ${userData.username} created`);
        }
      }

      // Create sample members if they don't exist
      const memberCount = await Member.countDocuments();
      if (memberCount === 0) {
        const members = await Member.insertMany([
          { name: 'John Doe', email: 'john@example.com', phone: '111-222-3333', branchId: branches[0]._id, membershipType: 'premium', monthlyFee: 1000, fingerprintId: 101 },
          { name: 'Jane Smith', email: 'jane@example.com', phone: '444-555-6666', branchId: branches[1]._id, membershipType: 'basic', monthlyFee: 650, fingerprintId: 102 },
          { name: 'Alice Johnson', email: 'alice@example.com', phone: '777-888-9999', branchId: branches[0]._id, membershipType: 'vip', monthlyFee: 1500, isActive: false, fingerprintId: 103 },
        ]);
        console.log('Sample members created');

        // Create sample payments
        const paymentCount = await Payment.countDocuments();
        if (paymentCount === 0) {
          const now = new Date();
          const currentMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
          const lastMonth = `${now.getFullYear()}-${(now.getMonth()).toString().padStart(2, '0')}`; // For a pending payment from last month

          await Payment.insertMany([
            { memberId: members[0]._id, branchId: members[0].branchId, amount: 2000, paymentDate: new Date(), paymentMonth: currentMonth, paymentStatus: 'paid', paymentMethod: 'UPI', notes: 'Monthly fee' },
            { memberId: members[1]._id, branchId: members[1].branchId, amount: 1000, paymentDate: new Date(), paymentMonth: currentMonth, paymentStatus: 'paid', paymentMethod: 'Cash', notes: 'Monthly fee' },
            { memberId: members[2]._id, branchId: members[2].branchId, amount: 3000, paymentDate: new Date(), paymentMonth: currentMonth, paymentStatus: 'non_payable', notes: 'Inactive member' },
            { memberId: members[0]._id, branchId: members[0].branchId, amount: 2000, paymentDate: new Date(lastMonth), paymentMonth: lastMonth, paymentStatus: 'pending', notes: 'Previous month pending' },
          ]);
          console.log('Sample payments created');
        }

        // Create sample expenses (NEW)
        const expenseCount = await Expense.countDocuments();
        if (expenseCount === 0) {
          const now = new Date();
          await Expense.insertMany([
            { reason: 'Rent', amount: 5000, date: now, branchId: branches[0]._id },
            { reason: 'Electricity Bill', amount: 1200, date: now, branchId: branches[0]._id },
            { reason: 'Equipment Maintenance', amount: 800, date: now, branchId: branches[1]._id },
            { reason: 'Cleaning Supplies', amount: 300, date: now, branchId: branches[0]._id },
          ]);
          console.log('Sample expenses created');
        }
      }
    }
  } catch (error) {
    console.error('Error initializing sample data:', error);
  }
}
