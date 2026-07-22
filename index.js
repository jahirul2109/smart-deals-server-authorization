require('dotenv').config()
const express = require('express')
const cors = require('cors')
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const { initializeApp, cert } = require("firebase-admin");
const { getAuth } = require("firebase-admin/auth")
const port = process.env.PORT || 4000;

// product_db
// bR9AuruIU1pq8oxl
// Midlewear
app.use(cors())
app.use(express.json())

const decodedFirebaseServiceKey = Buffer.from(process.env.FIREBASE_SERVICE_KEY, "base64").toString('utf8');
const serviceAccount = JSON.parse(decodedFirebaseServiceKey);

initializeApp({
    credential: cert(serviceAccount)
});


const verifyFirebaseToken = async (req, res, next) => {
    try {
        const authorization = req.headers.authorization;
        if (!authorization) {
            return res.status(401).send({ message: "unauthorized access" })
        }
        const token = authorization.split(" ")[1];
        if (!token) {
            return res.status(401).send({ message: "unauthorized access" })
        }
        const decoded = await getAuth().verifyIdToken(token);
        req.decoded = decoded;
        next()
    }
    catch (error) {
        console.log('token error:', error)
        return res.status(401).send({ message: "unauthorized access" })
    }
}

const uri = `mongodb+srv://${process.env.USER_ID}:${process.env.USER_PASS}@cluster0.b6s1ev2.mongodb.net/?appName=Cluster0`;
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
})

async function run() {
    try {
        await client.connect()
        const productDB = client.db('product_db');
        const productColl = productDB.collection('product_collection');
        const bidsCollection = productDB.collection('bids')
        const userCollection = productDB.collection('userCollection')


        // Add new user
        app.post('/user', async (req, res) => {
            const newUser = req.body;
            const email = newUser.email;
            const query = { email: email }
            const existinguser = await userCollection.findOne(query);
            if (existinguser) {
                res.send(JSON.stringify('User Already Existing'))
            }
            else {
                // console.log('new user add', newUser)
                const result = await userCollection.insertOne(newUser);
                res.send(result)
            }
        })

        // get all user
        app.get('/user', async (req, res) => {
            const cursor = userCollection.find()
            const result = await cursor.toArray()
            res.send(result)
        })
        // Make Product api data
        app.post('/product', verifyFirebaseToken, async (req, res) => {
            console.log("after usering authorizetion", req.headers)
            const newProduct = req.body;

            if (newProduct.email !== req.decoded.email) {
                return res.status(403).send({ message: "forbidden access" })
            }
            newProduct.created_at = new Date();
            const result = await productColl.insertOne(newProduct)
            res.send(result)
        })

        // Only authoriz user can access 

        app.get('/verify_product', verifyFirebaseToken, async (req, res) => {
            const email = req.query.email;
            const query = {}
            if (email) {
                query.email = email;
            }
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: "forbidden access" })
            }
            query.email = req.decoded.email;
            const result = await productColl.find(query).toArray();
            res.send(result)
        })
        // app.get('/verify_product', verifyFirebaseToken,async (req, res) => {
        //     const email = req.query.email;
        //     const query = {}
        //     if (email) {
        //         query.email = email;
        //     }
        //     // if (email !== req.decode.email) {
        //     //     return res.status(403).send({ message: "Forbiden Access" })
        //     // }
        //     // query.email =  req.decode.email

        //     const result = await productColl.find(query).toArray();
        //     res.send(result);
        // });

        // update product details
        app.patch('/product/:id', async (req, res) => {
            const id = req.params.id;
            const product = req.body;
            const qurey = {
                _id: new ObjectId(id)
            }
            const updateProduct = {
                $set: {
                    name: product.name,
                    price: product.price,
                    quality: product.quality
                }
            }
            const result = await productColl.updateOne(qurey, updateProduct);
            res.send(result)
        })

        // get single product api 
        app.get('/product/:productId', async (req, res) => {
            const id = req.params.productId;
            const qurey = {
                _id: new ObjectId(id)
            };
            const result = await productColl.findOne(qurey);
            res.send(result)
        })

        // Delete product 
        app.delete('/product/:id', async (req, res) => {
            const id = req.params.id;
            const query = {
                _id: new ObjectId(id)
            };
            const result = await productColl.deleteOne(query)
            res.send(result)
        })

        // get recent product 
        app.get('/recent-product', async (req, res) => {
            const cursor = productColl.find().sort({ created_at: -1 }).limit(6);
            const result = await cursor.toArray();
            res.send(result)
        })

        //  search sepecific product
        app.get('/product', async (req, res) => {
            const search = req.query.search;
            const query = {};
            if (search) {
                query.title = {
                    $regex: search,
                    $options: 'i'
                }
            };
            const result = await productColl.find(query).toArray();
            res.send(result)
        })
        // Get all product api 
        // app.get('/product', async (req, res) => {
        //     // const projectFildes = {
        //     //     title : 1, 
        //     //     price_min : 1,
        //     //     price_max : 1
        //     // }
        //     // const cursor = productColl.find().sort({price_min : -1}).limit(3).project(projectFildes).skip(2);
        //     const cursor = productColl.find()
        //     const result = await cursor.toArray();
        //     res.send(result)
        // })

        // JWT realted API 
        // app.post('/getToken', (req, res) => {
        //     const user = req.body
        //     const token = jwt.sign(user, process.env.SECRATE_KEY, { expiresIn: "1h" })
        //     // console.log(token)
        //     res.send({ token: token })
        // })

        app.get('/bids/:productId', async (req, res) => {
            const productId = req.params.productId;
            const query = {
                product: productId
            };
            const result = await bidsCollection.find(query).sort({ bid_price: 1 }).toArray();
            res.send(result)
        })
        // // verify with firebase accessToken
        // app.get('/bids', verifyJwtToken, async (req, res) => {
        //     console.log(req.headers)
        //     const email = req.query.email;
        //     console.log('decode Email', req.decode.email)
        //     if (email !== req.decode.email) {
        //         return res.status(401).send({ message: "unauthorized access" });
        //     }
        //     const query = {
        //         buyer_email: req.decode.email
        //     };

        //     const cursor = bidsCollection.find(query);
        //     const reslt = await cursor.toArray();
        //     res.send(reslt)
        // })


        // verify with coustome JWT token 
        app.get('/bids', async (req, res) => {
            const email = req.query.email;
            const query = {}
            if (email) {
                query.buyer_email = email
            };
            // if (email !== req.token_email) {
            //     return res.status(403).send({ message: "forbiden access" })
            // }
            const cursor = bidsCollection.find(query);
            const result = await cursor.toArray();
            res.send(result)
        })

        // Remove Bids form list
        app.delete('/bids/:id', async (req, res) => {
            const id = req.params.id;
            const query = {
                _id: new ObjectId(id)
            }
            const result = await bidsCollection.deleteOne(query)
            res.send(result)
        })
        // app.get('')
        // add new bids
        app.post('/bids', async (req, res) => {
            const newBids = req.body;
            const result = await bidsCollection.insertOne(newBids);
            // console.log(newBids)
            res.send(result)
        })
    }
    finally {

    }
}
run().catch(console.dir)

// client.connect()
// .then(()=> {
//     console.log('MongoDB connected')
//     app.listen(port, () => {
//     console.log("Server is connecting on port", port)
// })
// })
// .catch((err)=> console.log(err))

app.get('/', (req, res) => {
    res.send('Hello world');
})
app.listen(port, () => {
    console.log("Server is connecting on port", port)
})