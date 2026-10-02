/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        brand: "#7E49C2",
        ink: "#3D174F",
        muted: "#817493",
        canvas: "#FBF9FF",
        lavender: "#F4EEFC",
        line: "#D8C1F0",
        danger: "#B42318",
        success: "#087A55",
      },
    },
  },
  plugins: [],
};
