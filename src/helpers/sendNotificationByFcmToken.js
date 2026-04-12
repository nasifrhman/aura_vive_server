// const admin = require("firebase-admin");
// const { getMessaging } = require("firebase-admin/messaging");
// // Use `require` to load the JSON file
// const serviceAccount = require("../../../googleFirebaseAdmin.json"); // Adjust the path accordingly

// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount),
// });

// // Function to send notification to a user
// const sendNotificationByFcmToken = async (receiverId, textMessage) => {
//   console.log({ receiverId, textMessage });

//   // Fetch the user by ID
//   const findUser = await User.findOne({ _id: receiverId });

//   console.log({ findUser });

//   // If the user is not found, log and return early
//   if (!findUser) {
//     console.log(`User with id ${receiverId} not found`);
//     return;
//   }

//   const { fcmToken } = findUser;

//   // Ensure the FCM token is valid
//   if (!fcmToken?.trim()) {
//     console.log(`No valid FCM token found for user: ${receiverId}`);
//     return;
//   }

//   // Construct the notification message
//   const message = {
//     notification: {
//       body: textMessage, // Set the body of the notification
//     },
//     token: fcmToken, // Use the user's FCM token to send the message
//   };

//   getMessaging()
//     .send(message)
//     .then((response) => {
//       console.log("Successfully sent message:", response);
//     })
//     .catch((error) => {
//       console.log("Error sending message:", error);
//     });
// };

// module.exports = { sendNotificationByFcmToken };
