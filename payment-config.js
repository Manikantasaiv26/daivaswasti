// Offerings checkout settings for Daiva Swasti.
// Card numbers are never collected here. Put only the public Razorpay Key ID
// (Dashboard → API Keys). Never put the Razorpay Key Secret in this file.
window.DAIVA_PAYMENT = {
  payeeName: "Daiva Swasti",
  // UPI payments are credited to this VPA.
  upiId: "manikantasaiv@ybl",
  // Public Razorpay Key ID, for example "rzp_live_..." or "rzp_test_...".
  razorpayKeyId: "",
  minAmount: 101,
  maxAmount: 200000,
  notifyEmail: "pranam@daivaswasti.org"
};
