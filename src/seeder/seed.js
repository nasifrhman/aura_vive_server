const adminModel = require("../modules/Admin/admin.model");
const User = require("../modules/User/user.model");

const adminEmail = process.env.ADMIN_EMAIL;
const adminPassword = process.env.ADMIN_PASSWORD;

const seedAdmin = async () => {
  try {
    const existingAdmin = await User.findOne({ role : 'admin' });
    if (!existingAdmin) {
      await User.create({
        fullName: "Paula Mijo",
        email: adminEmail,
        password: adminPassword,
        role: 'admin',
      });
      await adminModel.create({
        user: existingAdmin._id,
        role: 'admin',
        categoryPermissions: ['administration']
      });
      console.log("✅ Admin user created successfully.");
    } else {
      console.log("✅ Admin user already exists.");
    }
  } catch (error) {
    console.error("❌ Error creating admin user:", error);
  }
};


module.exports = {
  seedAdmin
}

