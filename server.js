import express from "express";
import { prisma } from "./src/lib/prisma.js";

const app = express();
app.use(express.json());

// TEST ROUTE
app.get("/", (req, res) => {
  res.send("Server is working 🚀");
});

// GET PHASES FROM DATABASE
app.get("/phases", async (req, res) => {
  try {
    const phases = await prisma.phase.findMany({
      orderBy: { phaseName: "asc" }
    });

    res.json(phases);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
