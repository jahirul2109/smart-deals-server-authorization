require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const admin = require("firebase-admin");
const { getAuth } =require("firebase-admin/auth");

const app = express();

app.use(cors());
app.use(express.json());

const decodedFirebaseServiceKey = Buffer.from(
  process.env.FIREBASE_SERVICE_KEY,
  "base64"
).toString("utf8");

const serviceAccount = JSON.parse(decodedFirebaseServiceKey);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const uri = `mongodb+srv://${process.env.USER_ID}:${process.env.USER_PASS}@cluster0.b6s1ev2.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let productColl;
let bidsCollection;
let userCollection;

async function connectDB() {
  if (productColl) return;

  await client.connect();

  const db = client.db("product_db");

  productColl = db.collection("product_collection");
  bidsCollection = db.collection("bids");
  userCollection = db.collection("userCollection");

  console.log("Mongo Connected");
}

const verifyFirebaseToken = async (req, res, next) => {
  try {
    const authorization = req.headers.authorization;

    if (!authorization) {
      return res.status(401).send({ message: "Unauthorized" });
    }

    const token = authorization.split(" ")[1];

    const decoded = await getAuth().verifyIdToken(token);

    req.decoded = decoded;

    next();
  } catch (err) {
    console.log(err);
    res.status(401).send({ message: "Unauthorized" });
  }
};

// middleware
app.use(async (req, res, next) => {
  await connectDB();
  next();
});

app.get("/", (req, res) => {
  res.send({
    message: "Hello World",
    mongo: "Connected",
  });
});

// user

app.post("/user", async (req, res) => {
  const newUser = req.body;

  const exist = await userCollection.findOne({
    email: newUser.email,
  });

  if (exist) {
    return res.send("User Already Exists");
  }

  const result = await userCollection.insertOne(newUser);

  res.send(result);
});

app.get("/user", async (req, res) => {
  const result = await userCollection.find().toArray();

  res.send(result);
});

// products

app.post("/product", verifyFirebaseToken, async (req, res) => {
  const product = req.body;

  if (product.email !== req.decoded.email) {
    return res.status(403).send({
      message: "Forbidden",
    });
  }

  product.created_at = new Date();

  const result = await productColl.insertOne(product);

  res.send(result);
});

app.get("/product", async (req, res) => {
  const search = req.query.search;

  const query = {};

  if (search) {
    query.title = {
      $regex: search,
      $options: "i",
    };
  }

  const result = await productColl.find(query).toArray();

  res.send(result);
});

app.get("/product/:id", async (req, res) => {
  const result = await productColl.findOne({
    _id: new ObjectId(req.params.id),
  });

  res.send(result);
});

app.delete("/product/:id", async (req, res) => {
  const result = await productColl.deleteOne({
    _id: new ObjectId(req.params.id),
  });

  res.send(result);
});

app.patch("/product/:id", async (req, res) => {
  const result = await productColl.updateOne(
    {
      _id: new ObjectId(req.params.id),
    },
    {
      $set: req.body,
    }
  );

  res.send(result);
});

app.get("/recent-product", async (req, res) => {
  const result = await productColl
    .find()
    .sort({ created_at: -1 })
    .limit(6)
    .toArray();

  res.send(result);
});

app.get("/verify_product", verifyFirebaseToken, async (req, res) => {
  if (req.query.email !== req.decoded.email) {
    return res.status(403).send({
      message: "Forbidden",
    });
  }

  const result = await productColl
    .find({
      email: req.decoded.email,
    })
    .toArray();

  res.send(result);
});

// bids

app.post("/bids", async (req, res) => {
  const result = await bidsCollection.insertOne(req.body);

  res.send(result);
});

app.get("/bids", async (req, res) => {
  const query = {};

  if (req.query.email) {
    query.buyer_email = req.query.email;
  }

  const result = await bidsCollection.find(query).toArray();

  res.send(result);
});

app.get("/bids/:productId", async (req, res) => {
  const result = await bidsCollection
    .find({
      product: req.params.productId,
    })
    .sort({ bid_price: 1 })
    .toArray();

  res.send(result);
});

app.delete("/bids/:id", async (req, res) => {
  const result = await bidsCollection.deleteOne({
    _id: new ObjectId(req.params.id),
  });

  res.send(result);
});

module.exports = app;