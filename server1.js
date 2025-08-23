const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// NEW: Require PDFKit for PDF generation
const PDFDocument = require('pdfkit');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// MongoDB Atlas connection string
const mongoAtlasUri = 'mongodb+srv://ajithtest95:ajith%40123@cluster0.n3qvh.mongodb.net/gym_management?retryWrites=true&w=majority';

// JWT Secret Key - In a production environment, use environment variables
const JWT_SECRET = 'your_super_secret_key_here';

// MongoDB Connection
mongoose.connect(mongoAtlasUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB Atlas Connected Successfully!'))
.catch(err => console.error('MongoDB Atlas connection error:', err));


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
  createdAt: { type: Date, default: Date.now }
});

const paymentSchema = new mongoose.Schema({
  memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Member' },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
  amount: Number,
  paymentDate: { type: Date, default: Date.now },
  paymentMonth: Date, // For which month the payment is for
  paymentStatus: { type: String, enum: ['paid', 'pending', 'non_payable'], default: 'pending' },
  paymentMethod: String,
  notes: String,
  createdAt: { type: Date, default: Date.now }
});

const attendanceSchema = new mongoose.Schema({
    memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Member' },
    date: { type: Date, default: Date.now },
    status: { type: String, enum: ['present', 'absent'], default: 'present' }
});

// NEW: Expense Schema
const expenseSchema = new mongoose.Schema({
    reason: String,
    amount: Number,
    date: { type: Date, default: Date.now },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
    createdAt: { type: Date, default: Date.now }
});

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    isAdmin: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
});


// Models
const Branch = mongoose.model('Branch', branchSchema);
const Member = mongoose.model('Member', memberSchema);
const Payment = mongoose.model('Payment', paymentSchema);
const Attendance = mongoose.model('Attendance', attendanceSchema);
const User = mongoose.model('User', userSchema);
const Expense = mongoose.model('Expense', expenseSchema); // NEW: Expense Model


// JWT Middleware for Authentication
const auth = (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
        return res.status(401).send({ message: 'Authentication required.' });
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (e) {
        res.status(401).send({ message: 'Invalid token.' });
    }
};


// API Endpoints
// Login route
app.post('/api/login', async (req, res) => {
    try {
        const user = await User.findOne({ username: req.body.username });
        if (!user) {
            return res.status(400).send({ message: 'Invalid username or password.' });
        }
        const isMatch = await bcrypt.compare(req.body.password, user.password);
        if (!isMatch) {
            return res.status(400).send({ message: 'Invalid username or password.' });
        }
        const token = jwt.sign({ _id: user._id, username: user.username }, JWT_SECRET, { expiresIn: '2h' });
        res.send({ username: user.username, token });
    } catch (error) {
        res.status(500).send({ message: 'Server error during login.' });
    }
});


// Branches API
app.get('/api/branches', auth, async (req, res) => {
    try {
        const branches = await Branch.find();
        res.json(branches);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});


// Members API
app.get('/api/members', auth, async (req, res) => {
    try {
        const members = await Member.find().populate('branchId');
        res.json(members);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.post('/api/members', auth, async (req, res) => {
    const member = new Member(req.body);
    try {
        const newMember = await member.save();
        res.status(201).json(newMember);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

app.put('/api/members/:id', auth, async (req, res) => {
    try {
        const updatedMember = await Member.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedMember) {
            return res.status(404).json({ message: 'Member not found' });
        }
        res.json(updatedMember);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

app.delete('/api/members/:id', auth, async (req, res) => {
    try {
        const deletedMember = await Member.findByIdAndDelete(req.params.id);
        if (!deletedMember) {
            return res.status(404).json({ message: 'Member not found' });
        }
        res.json({ message: 'Member deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Payments API
app.get('/api/payments', auth, async (req, res) => {
    try {
        const payments = await Payment.find();
        res.json(payments);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.get('/api/payments/with-details', auth, async (req, res) => {
    try {
        const payments = await Payment.find()
            .populate('memberId', 'name phone')
            .populate('branchId', 'name');
        
        const paymentsWithDetails = payments.map(p => ({
            ...p._doc,
            memberName: p.memberId.name,
            memberPhone: p.memberId.phone,
            branchName: p.branchId.name
        }));
        res.json(paymentsWithDetails);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.get('/api/payments/:id', auth, async (req, res) => {
    try {
        const payment = await Payment.findById(req.params.id);
        if (!payment) return res.status(404).json({ message: 'Payment not found' });
        res.json(payment);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.post('/api/payments', auth, async (req, res) => {
    const payment = new Payment({
        ...req.body,
        paymentMonth: new Date(req.body.paymentMonth)
    });
    try {
        const member = await Member.findById(req.body.memberId);
        if (member) {
            payment.branchId = member.branchId;
        } else {
            return res.status(404).json({ message: 'Member not found' });
        }
        const newPayment = await payment.save();
        res.status(201).json(newPayment);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

app.put('/api/payments/:id', auth, async (req, res) => {
    try {
        const updatedPayment = await Payment.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedPayment) {
            return res.status(404).json({ message: 'Payment not found' });
        }
        res.json(updatedPayment);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

app.delete('/api/payments/:id', auth, async (req, res) => {
    try {
        const deletedPayment = await Payment.findByIdAndDelete(req.params.id);
        if (!deletedPayment) {
            return res.status(404).json({ message: 'Payment not found' });
        }
        res.json({ message: 'Payment deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Bulk Payment Update
app.put('/api/payments/bulk-update', auth, async (req, res) => {
    const { memberId, paymentMonth, paymentStatus } = req.body;
    try {
        let query = { paymentMonth: new Date(paymentMonth) };
        if (memberId) {
            query.memberId = memberId;
        }

        const result = await Payment.updateMany(query, { paymentStatus });
        res.json({ message: `${result.modifiedCount} payments updated.` });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});


// NEW: PDF Receipt Generation Endpoint
app.get('/api/payments/:id/receipt', auth, async (req, res) => {
    try {
        const payment = await Payment.findById(req.params.id)
            .populate('memberId')
            .populate('branchId');

        if (!payment) {
            return res.status(404).json({ message: 'Payment not found' });
        }

        const doc = new PDFDocument();
        const filename = `receipt_${payment._id}.pdf`;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        doc.pipe(res);

        // Add content to the PDF
        doc.fontSize(25).text('Payment Receipt', { align: 'center' });
        doc.moveDown();

        doc.fontSize(16).text(`Member Name: ${payment.memberId.name}`);
        doc.text(`Amount: ₹${payment.amount}`);
        doc.text(`Payment Month: ${new Date(payment.paymentMonth).toLocaleString('default', { month: 'long', year: 'numeric' })}`);
        doc.text(`Payment Status: ${payment.paymentStatus}`);
        doc.text(`Payment Method: ${payment.paymentMethod}`);
        doc.text(`Branch: ${payment.branchId.name}`);
        doc.text(`Notes: ${payment.notes || 'N/A'}`);
        doc.text(`Date: ${new Date(payment.paymentDate).toLocaleString()}`);
        doc.end();

    } catch (error) {
        console.error('Error generating PDF:', error);
        res.status(500).json({ message: 'Error generating receipt' });
    }
});


// Attendance API
app.get('/api/attendance', auth, async (req, res) => {
    try {
        const attendance = await Attendance.find()
            .populate('memberId', 'name');
        
        const attendanceWithDetails = attendance.map(a => ({
            ...a._doc,
            memberName: a.memberId.name
        }));
        res.json(attendanceWithDetails);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.post('/api/attendance', auth, async (req, res) => {
    const { memberId, date, status } = req.body;
    const attendanceRecord = new Attendance({
        memberId,
        date,
        status
    });
    try {
        const newRecord = await attendanceRecord.save();
        res.status(201).json(newRecord);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});


// NEW: Expenses API
app.get('/api/expenses', auth, async (req, res) => {
    try {
        const expenses = await Expense.find();
        res.json(expenses);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// NEW: Expense with Branch details
app.get('/api/expenses/with-branch', auth, async (req, res) => {
    try {
        const expenses = await Expense.find().populate('branchId', 'name');
        const expensesWithDetails = expenses.map(e => ({
            ...e._doc,
            branchName: e.branchId.name
        }));
        res.json(expensesWithDetails);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// NEW: Get a single expense by ID
app.get('/api/expenses/:id', auth, async (req, res) => {
    try {
        const expense = await Expense.findById(req.params.id);
        if (!expense) return res.status(404).json({ message: 'Expense not found' });
        res.json(expense);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// NEW: Add a new expense
app.post('/api/expenses', auth, async (req, res) => {
    const expense = new Expense(req.body);
    try {
        const newExpense = await expense.save();
        res.status(201).json(newExpense);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// NEW: Update an expense
app.put('/api/expenses/:id', auth, async (req, res) => {
    try {
        const updatedExpense = await Expense.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedExpense) {
            return res.status(404).json({ message: 'Expense not found' });
        }
        res.json(updatedExpense);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// NEW: Delete an expense
app.delete('/api/expenses/:id', auth, async (req, res) => {
    try {
        const deletedExpense = await Expense.findByIdAndDelete(req.params.id);
        if (!deletedExpense) {
            return res.status(404).json({ message: 'Expense not found' });
        }
        res.json({ message: 'Expense deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Initial data seeding
const createInitialData = async () => {
  try {
    // Check if a default user exists, if not, create one
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await User.create({ username: 'admin', password: hashedPassword });
      console.log('Default admin user created.');
    }

    // Check if branches exist
    const branchCount = await Branch.countDocuments();
    let branches;
    if (branchCount === 0) {
      branches = await Branch.insertMany([
        { name: 'Main Branch', location: 'City Center', contact: '123-456-7890' },
        { name: 'South Branch', location: 'South Side', contact: '098-765-4321' }
      ]);
      console.log('Sample branches created');
    } else {
      branches = await Branch.find();
    }

    // Check if members exist
    const memberCount = await Member.countDocuments();
    let members;
    if (memberCount === 0) {
      members = await Member.insertMany([
        { name: 'John Doe', email: 'john@example.com', phone: '123-456-7890', branchId: branches[0]._id, membershipType: 'Monthly', isActive: true },
        { name: 'Jane Smith', email: 'jane@example.com', phone: '098-765-4321', branchId: branches[1]._id, membershipType: 'Yearly', isActive: true },
        { name: 'Peter Jones', email: 'peter@example.com', phone: '111-222-3333', branchId: branches[0]._id, membershipType: 'Monthly', isActive: false },
      ]);
      console.log('Sample members created');
    } else {
      members = await Member.find();
    }
    
    // Create sample payments
    const paymentCount = await Payment.countDocuments();
    if (paymentCount === 0) {
      const currentMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const lastMonth = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);

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

  } catch (error) {
    console.error('Error creating initial data:', error);
  }
};


// Start the server after seeding initial data
mongoose.connection.once('open', async () => {
    await createInitialData();
    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
});