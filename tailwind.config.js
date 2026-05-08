export default {
  content: ["./index.html", "./script.js"],
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        ink: "#684768",
        paper: "#f7ead8",
        "paper-soft": "#fbf2e8",
      },
    },
  },
};
