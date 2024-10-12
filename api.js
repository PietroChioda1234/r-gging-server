const express = require("express");
const { MongoClient, ObjectId } = require("mongodb");
const cors = require("cors");
// Create an Express app
const app = express();
const port = 3000;

// Middleware to parse JSON request bodies
// Define the CORS options
const corsOptions = {
  origin: function (origin, callback) {
    if (
      [
        "http://localhost:3001",
        "http://localhost:80",
        "http://localhost:5500",
        "http://127.0.0.1:5500",
      ].indexOf(origin) !== -1 ||
      !origin // Allow requests with no origin, such as from curl or Postman
    ) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
};

app.use(cors(corsOptions)); // Use the cors middleware with your options
// app.use(cors());

app.use(express.json({ limit: "50mb" })); // High limit
app.use(express.urlencoded({ limit: "50mb" })); // High limit

// Add headers before the routes are defined
app.use(function (req, res, next) {
  const allowedOrigins = ["http://localhost:5500", "http://127.0.0.1:5500"];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS, PUT, PATCH, DELETE"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-Requested-With,content-type"
  );
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader("Content-Type", "application/json");

  next();
});

// MongoDB connection URI
const uri =
  "mongodb+srv://pietrochiodapc:gXsMhEdIKwTF0r6S@test.xepk5.mongodb.net/?retryWrites=true&w=majority&appName=test";
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Database and collection names
const dbName = "drift";
const collectionName = "marker";

// Connect to MongoDB before starting the server
client
  .connect()
  .then(() => {
    const db = client.db(dbName);
    const collection = db.collection(collectionName);

    // // GET /books - Retrieve all books
    // app.get("/marker", async (req, res) => {
    //   try {
    //     const entries = await collection.find({}).toArray();
    //     console.log("Entries retrieved:", entries); // Log the entries to verify
    //     res.status(200).json(entries);
    //   } catch (err) {
    //     console.error("Error retrieving entries:", err);
    //     res.status(500).json({ message: "Error retrieving ", error: err });
    //   }
    // });

    // // GET /books/:id - Retrieve a single book by ID
    // app.get("/marker/:id", async (req, res) => {
    //   const { id } = req.params;
    //   try {
    //     const entry = await collection.findOne({ _id: new ObjectId(id) });
    //     if (!entry) {
    //       res.status(404).json({ message: " not found" });
    //     } else {
    //       res.status(200).json(entry);
    //     }
    //   } catch (err) {
    //     res.status(500).json({ message: "Error retrieving ", error: err });
    //   }
    // });
    app.post("/elevation", async (req, res) => {
      const { locations } = req.body;
      const url = `https://api.open-elevation.com/api/v1/lookup`;
      console.log(locations);
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ locations: locations }),
        });

        const data = await response.json();
        res.json(data);
      } catch (error) {
        console.log(data);
        res.status(500).send("Error fetching elevation data" + error);
      }
    });
    app.get("/marker", async (req, res) => {
      const { lat, lon } = req.query;
      if (!lat || !lon) {
        try {
          const entries = await collection.find({}).toArray();
          console.log("Entries retrieved:", entries); // Log the entries to verify
          res.status(200).json(entries);
        } catch (e) {
          console.error("Error retrieving entries:", e);
          res.status(500).json({ message: "Error retrieving ", error: e });
        }
      } else {
        // Convert lat and lon to numbers
        const latitude = parseFloat(lat);
        const longitude = parseFloat(lon);

        try {
          // Check if any existing marker has the same rounded coordinates
          const entry = await findMarkerByLatLon(latitude, longitude);

          if (!entry) {
            res.status(404).json({ message: "Entry not found" });
          } else {
            res.status(200).json(entry);
          }
        } catch (err) {
          res
            .status(500)
            .json({ message: "Error retrieving entry", error: err.message });
        }
      }
    });

    // POST /books - Create a new book
    app.post("/marker", async (req, res) => {
      try {
        const newEntry = req.body;
        const latitude = newEntry.coordinates[0];
        const longitude = newEntry.coordinates[1];
        // Ensure latitude and longitude exist
        if (!latitude || !longitude) {
          return res
            .status(400)
            .json({ message: "Latitude and Longitude are required" });
        }

        // Check if any existing marker has the same rounded coordinates
        const existingMarker = await findMarkerByLatLon(latitude, longitude);

        if (existingMarker) {
          return res.status(409).json({
            message: "Marker with similar coordinates already exists",
          });
        }

        // Proceed with inserting the new marker
        const result = await collection.insertOne({
          ...newEntry,
          latitude: roundedLat,
          longitude: roundedLong,
        });
        res
          .status(201)
          .json({ message: "Marker created", id: result.insertedId });
      } catch (err) {
        console.error("Error processing request:", err);
        res
          .status(500)
          .json({ message: "Error processing request", error: err });
      }
    });

    // ADD VOTE
    app.put("/marker/vote", async (req, res) => {
      const { lat, lon, vote } = req.body;

      // Convert lat and lon to numbers
      const latitude = parseFloat(lat);
      const longitude = parseFloat(lon);
      const mark = parseInt(vote);
      try {
        console.log(latitude + " " + longitude);
        const entry = await findMarkerByLatLon(latitude, longitude);
        console.log(entry);
        entry.votes = entry.votes + 1;
        entry.community_vote =
          (entry.community_vote * (entry.votes - 1) + mark) / entry.votes;
        try {
          const result = await collection.updateOne(
            { _id: new ObjectId(entry._id) },
            { $set: entry }
          );
          if (result.matchedCount === 0) {
            res.status(404).json({ message: " not found" });
          } else {
            res.status(200).json({ message: " updated" });
          }
        } catch (err) {
          res.status(500).json({ message: "Error updating ", error: err });
        }
      } catch (err) {
        res
          .status(500)
          .json({ message: "Error retrieving entry", error: err.message });
      }
    });
    app.put("/marker/:id", async (req, res) => {
      const { id } = req.params;
      const updateEntry = req.body;
      try {
        const result = await collection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updateEntry }
        );
        if (result.matchedCount === 0) {
          res.status(404).json({ message: " not found" });
        } else {
          res.status(200).json({ message: " updated" });
        }
      } catch (err) {
        res.status(500).json({ message: "Error updating ", error: err });
      }
    });
    // DELETE /books/:id - Delete a book by ID
    app.delete("/marker/:id", async (req, res) => {
      const { id } = req.params;
      try {
        const result = await collection.deleteOne({
          _id: new ObjectId(id),
        });
        if (result.deletedCount === 0) {
          res.status(404).json({ message: " not found" });
        } else {
          res.status(200).json({ message: " deleted" });
        }
      } catch (err) {
        res.status(500).json({ message: "Error deleting ", error: err });
      }
    });
    async function findMarkerByLatLon(latitude, longitude) {
      // Round the coordinates to 5 decimal places
      const roundedLat = parseFloat(latitude.toFixed(5));
      const roundedLong = parseFloat(longitude.toFixed(5));

      // Retrieve all markers from the collection
      const allMarkers = await collection.find({}).toArray();

      // Check if any existing marker has the same rounded coordinates
      const existingMarker = allMarkers.find((marker) => {
        const markerLat = parseFloat(marker.coordinates[0].toFixed(5));
        const markerLong = parseFloat(marker.coordinates[1].toFixed(5));
        return markerLat === roundedLat && markerLong === roundedLong;
      });
      return existingMarker;
    }
    // Start the server
    app.listen(port, () => {
      console.log(`Server running at http://localhost:${port}`);
    });
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB", err);
  });
