const mongoose = require('mongoose');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/gym_management', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Define schemas (same as in server.js)
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
  paymentMonth: String,
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
  duration: Number,
  createdAt: { type: Date, default: Date.now }
});

// Create models
const Branch = mongoose.model('Branch', branchSchema);
const Member = mongoose.model('Member', memberSchema);
const Payment = mongoose.model('Payment', paymentSchema);
const Attendance = mongoose.model('Attendance', attendanceSchema);

// Sample data
const sampleBranches = [
  {
    name: 'Downtown Fitness Hub',
    location: '123 Main Street, Downtown',
    contact: '+91-9876543210'
  },
  {
    name: 'Westside Gym',
    location: '456 West Avenue, Westside',
    contact: '+91-9876543211'
  },
  {
    name: 'Eastside Wellness Center',
    location: '789 East Boulevard, Eastside',
    contact: '+91-9876543212'
  },
  {
    name: 'Northside Fitness Club',
    location: '321 North Road, Northside',
    contact: '+91-9876543213'
  }
];

const sampleMembers = [
  {
    name: 'Arjun Sharma',
    email: 'arjun.sharma@email.com',
    phone: '+91-9876543220',
    membershipType: 'premium',
    monthlyFee: 2000,
    emergencyContact: '+91-9876543221',
    isActive: true,
    joinDate: new Date('2024-01-15')
  },
  {
    name: 'Priya Patel',
    email: 'priya.patel@email.com',
    phone: '+91-9876543222',
    membershipType: 'basic',
    monthlyFee: 1000,
    emergencyContact: '+91-9876543223',
    isActive: true,
    joinDate: new Date('2024-02-01')
  },
  {
    name: 'Rahul Kumar',
    email: 'rahul.kumar@email.com',
    phone: '+91-9876543224',
    membershipType: 'vip',
    monthlyFee: 3000,
    emergencyContact: '+91-9876543225',
    isActive: true,
    joinDate: new Date('2024-01-10')
  },
  {
    name: 'Sneha Gupta',
    email: 'sneha.gupta@email.com',
    phone: '+91-9876543226',
    membershipType: 'premium',
    monthlyFee: 2000,
    emergencyContact: '+91-9876543227',
    isActive: false,
    joinDate: new Date('2024-03-05')
  },
  {
    name: 'Vikram Singh',
    email: 'vikram.singh@email.com',
    phone: '+91-9876543228',
    membershipType: 'basic',
    monthlyFee: 1000,
    emergencyContact: '+91-9876543229',
    isActive: true,
    joinDate: new Date('2024-01-20')
  },
  {
    name: 'Anita Verma',
    email: 'anita.verma@email.com',
    phone: '+91-9876543230',
    membershipType: 'vip',
    monthlyFee: 3000,
    emergencyContact: '+91-9876543231',
    isActive: true,
    joinDate: new Date('2024-02-10')
  },
  {
    name: 'Rohit Sharma',
    email: 'rohit.sharma@email.com',
    phone: '+91-9876543232',
    membershipType: 'premium',
    monthlyFee: 2000,
    emergencyContact: '+91-9876543233',
    isActive: true,
    joinDate: new Date('2024-01-25')
  },
  {
    name: 'Kavya Nair',
    email: 'kavya.nair@email.com',
    phone: '+91-9876543234',
    membershipType: 'basic',
    monthlyFee: 1000,
    emergencyContact: '+91-9876543235',
    isActive: true,
    joinDate: new Date('2024-02-15')
  },
  {
    name: 'Amit Thakur',
    email: 'amit.thakur@email.com',
    phone: '+91-9876543236',
    membershipType: 'vip',
    monthlyFee: 3000,
    emergencyContact: '+91-9876543237',
    isActive: true,
    joinDate: new Date('2024-01-30')
  },
  {
    name: 'Deepika Rao',
    email: 'deepika.rao@email.com',
    phone: '+91-9876543238',
    membershipType: 'premium',
    monthlyFee: 2000,
    emergencyContact: '+91-9876543239',
    isActive: true,
    joinDate: new Date('2024-02-20')
  },
  {
    name: 'Sanjay Gupta',
    email: 'sanjay.gupta@email.com',
    phone: '+91-9876543240',
    membershipType: 'basic',
    monthlyFee: 1000,
    emergencyContact: '+91-9876543241',
    isActive: false,
    joinDate: new Date('2024-03-01')
  },
  {
    name: 'Meera Joshi',
    email: 'meera.joshi@email.com',
    phone: '+91-9876543242',
    membershipType: 'vip',
    monthlyFee: 3000,
    emergencyContact: '+91-9876543243',
    isActive: true,
    joinDate: new Date('2024-01-05')
  },
  {
    name: 'Karan Malhotra',
    email: 'karan.malhotra@email.com',
    phone: '+91-9876543244',
    membershipType: 'premium',
    monthlyFee: 2000,
    emergencyContact: '+91-9876543245',
    isActive: true,
    joinDate: new Date('2024-02-25')
  },
  {
    name: 'Pooja Reddy',
    email: 'pooja.reddy@email.com',
    phone: '+91-9876543246',
    membershipType: 'basic',
    monthlyFee: 1000,
    emergencyContact: '+91-9876543247',
    isActive: true,
    joinDate: new Date('2024-01-12')
  },
  {
    name: 'Nitin Agarwal',
    email: 'nitin.agarwal@email.com',
    phone: '+91-9876543248',
    membershipType: 'vip',
    monthlyFee: 3000,
    emergencyContact: '+91-9876543249',
    isActive: true,
    joinDate: new Date('2024-02-05')
  },
  {
    name: 'Riya Mehta',
    email: 'riya.mehta@email.com',
    phone: '+91-9876543250',
    membershipType: 'premium',
    monthlyFee: 2000,
    emergencyContact: '+91-9876543251',
    isActive: false,
    joinDate: new Date('2024-03-10')
  },
  {
    name: 'Manish Tiwari',
    email: 'manish.tiwari@email.com',
    phone: '+91-9876543252',
    membershipType: 'basic',
    monthlyFee: 1000,
    emergencyContact: '+91-9876543253',
    isActive: true,
    joinDate: new Date('2024-01-18')
  },
  {
    name: 'Shreya Kapoor',
    email: 'shreya.kapoor@email.com',
    phone: '+91-9876543254',
    membershipType: 'vip',
    monthlyFee: 3000,
    emergencyContact: '+91-9876543255',
    isActive: true,
    joinDate: new Date('2024-02-12')
  },
  {
    name: 'Arpit Soni',
    email: 'arpit.soni@email.com',
    phone: '+91-9876543256',
    membershipType: 'premium',
    monthlyFee: 2000,
    emergencyContact: '+91-9876543257',
    isActive: true,
    joinDate: new Date('2024-01-28')
  },
  {
    name: 'Nisha Bansal',
    email: 'nisha.bansal@email.com',
    phone: '+91-9876543258',
    membershipType: 'basic',
    monthlyFee: 1000,
    emergencyContact: '+91-9876543259',
    isActive: true,
    joinDate: new Date('2024-02-18')
  }
];

async function seedDatabase() {
  try {
    // Clear existing data
    await Branch.deleteMany({});
    await Member.deleteMany({});
    await Payment.deleteMany({});
    await Attendance.deleteMany({});
    
    console.log('✅ Cleared existing data');
    
    // Create branches
    const branches = await Branch.insertMany(sampleBranches);
    console.log(`✅ Created ${branches.length} branches`);
    
    // Create members with branch assignments
    const membersWithBranches = sampleMembers.map((member, index) => ({
      ...member,
      branchId: branches[index % branches.length]._id
    }));
    
    const members = await Member.insertMany(membersWithBranches);
    console.log(`✅ Created ${members.length} members`);
    
    // Create payments for multiple months
    const payments = [];
    const currentDate = new Date();
    const paymentMethods = ['cash', 'card', 'upi', 'bank_transfer'];
    
    // Generate payments for last 6 months
    for (let monthOffset = 0; monthOffset < 6; monthOffset++) {
      const paymentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - monthOffset, 1);
      const paymentMonth = paymentDate.toISOString().substr(0, 7);
      
      members.forEach(member => {
        // Skip payment for inactive members for current month
        if (!member.isActive && monthOffset === 0) {
          return;
        }
        
        let paymentStatus = 'paid';
        if (monthOffset === 0) {
          // Current month: mix of paid and pending
          paymentStatus = Math.random() > 0.7 ? 'paid' : 'pending';
        } else if (monthOffset === 1) {
          // Last month: mostly paid with some pending
          paymentStatus = Math.random() > 0.9 ? 'pending' : 'paid';
        }
        
        const randomDay = Math.floor(Math.random() * 28) + 1;
        const actualPaymentDate = new Date(paymentDate.getFullYear(), paymentDate.getMonth(), randomDay);
        
        payments.push({
          memberId: member._id,
          branchId: member.branchId,
          amount: member.monthlyFee,
          paymentMonth: paymentMonth,
          paymentStatus: paymentStatus,
          paymentMethod: paymentMethods[Math.floor(Math.random() * paymentMethods.length)],
          paymentDate: actualPaymentDate,
          notes: paymentStatus === 'pending' ? 'Payment pending' : 'Payment completed'
        });
      });
    }
    
    await Payment.insertMany(payments);
    console.log(`✅ Created ${payments.length} payment records`);
    
    // Create attendance records for last 30 days
    const attendanceRecords = [];
    const activeMembers = members.filter(member => member.isActive);
    
    for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
      const attendanceDate = new Date();
      attendanceDate.setDate(attendanceDate.getDate() - dayOffset);
      attendanceDate.setHours(0, 0, 0, 0);
      
      // Weekend attendance is lower
      const isWeekend = attendanceDate.getDay() === 0 || attendanceDate.getDay() === 6;
      const attendanceRate = isWeekend ? 0.4 : 0.6;
      
      // Select random members for attendance
      const dailyAttendees = activeMembers
        .filter(() => Math.random() < attendanceRate)
        .slice(0, Math.floor(activeMembers.length * attendanceRate));
      
      dailyAttendees.forEach(member => {
        // Random check-in time between 6 AM and 10 AM
        const checkInTime = new Date(attendanceDate);
        checkInTime.setHours(
          Math.floor(Math.random() * 4) + 6, // 6-10 AM
          Math.floor(Math.random() * 60)     // Random minutes
        );
        
        // Most people check out, some are still in (for recent dates)
        const hasCheckedOut = dayOffset > 0 || Math.random() > 0.2;
        let checkOutTime = null;
        let duration = null;
        
        if (hasCheckedOut) {
          // Random workout duration between 60-240 minutes
          const workoutDuration = Math.floor(Math.random() * 180) + 60;
          checkOutTime = new Date(checkInTime.getTime() + workoutDuration * 60 * 1000);
          duration = workoutDuration;
        }
        
        attendanceRecords.push({
          memberId: member._id,
          branchId: member.branchId,
          checkInTime,
          checkOutTime,
          duration,
          createdAt: checkInTime
        });
      });
    }
    
    await Attendance.insertMany(attendanceRecords);
    console.log(`✅ Created ${attendanceRecords.length} attendance records`);
    
    console.log('\n🎉 Database seeding completed successfully!');
    
    // Display comprehensive summary
    console.log('\n📊 === SEEDING SUMMARY ===');
    console.log(`🏢 Branches: ${branches.length}`);
    console.log(`👥 Members: ${members.length}`);
    console.log(`💳 Payments: ${payments.length}`);
    console.log(`📅 Attendance Records: ${attendanceRecords.length}`);
    
    // Display branch distribution
    console.log('\n🏢 === BRANCH DISTRIBUTION ===');
    for (let i = 0; i < branches.length; i++) {
      const branchMembers = members.filter(m => m.branchId.equals(branches[i]._id));
      const activeBranchMembers = branchMembers.filter(m => m.isActive);
      console.log(`${branches[i].name}: ${branchMembers.length} total (${activeBranchMembers.length} active)`);
    }
    
    // Display membership type distribution
    console.log('\n💼 === MEMBERSHIP TYPE DISTRIBUTION ===');
    const membershipTypes = ['basic', 'premium', 'vip'];
    membershipTypes.forEach(type => {
      const count = members.filter(m => m.membershipType === type).length;
      const activeCount = members.filter(m => m.membershipType === type && m.isActive).length;
      console.log(`${type.toUpperCase()}: ${count} total (${activeCount} active)`);
    });
    
    // Display payment statistics
    console.log('\n💰 === PAYMENT STATISTICS ===');
    const currentMonth = new Date().toISOString().substr(0, 7);
    const currentMonthPayments = payments.filter(p => p.paymentMonth === currentMonth);
    const paidCurrentMonth = currentMonthPayments.filter(p => p.paymentStatus === 'paid');
    const pendingCurrentMonth = currentMonthPayments.filter(p => p.paymentStatus === 'pending');
    
    console.log(`Current Month (${currentMonth}):`);
    console.log(`  📈 Total Payments: ${currentMonthPayments.length}`);
    console.log(`  ✅ Paid: ${paidCurrentMonth.length}`);
    console.log(`  ⏳ Pending: ${pendingCurrentMonth.length}`);
    console.log(`  💵 Revenue: ₹${paidCurrentMonth.reduce((sum, p) => sum + p.amount, 0).toLocaleString()}`);
    console.log(`  📊 Collection Rate: ${Math.round((paidCurrentMonth.length / currentMonthPayments.length) * 100)}%`);
    
    // Display recent attendance
    console.log('\n📅 === RECENT ATTENDANCE ===');
    const today = new Date();
    const todayAttendance = attendanceRecords.filter(a => 
      a.createdAt.toDateString() === today.toDateString()
    );
    const yesterdayAttendance = attendanceRecords.filter(a => {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return a.createdAt.toDateString() === yesterday.toDateString();
    });
    
    console.log(`Today: ${todayAttendance.length} check-ins`);
    console.log(`Yesterday: ${yesterdayAttendance.length} check-ins`);
    
    // Display database connection info
    console.log('\n🔗 === DATABASE INFO ===');
    console.log(`Database: ${mongoose.connection.name}`);
    console.log(`Connection: ${mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'}`);
    console.log(`Host: ${mongoose.connection.host}:${mongoose.connection.port}`);
    
    console.log('\n✨ You can now start your server and access the gym management system!');
    console.log('🚀 Run: node server.js');
    
  } catch (error) {
    console.error('❌ Error seeding database:', error);
  } finally {
    // Close the connection
    mongoose.connection.close();
    console.log('\n🔒 Database connection closed.');
  }
}

// Run the seeding function
seedDatabase();