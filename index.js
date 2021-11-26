const express = require('express');
const { MongoClient } = require('mongodb');
const ObjectId = require('mongodb').ObjectId;
const admin = require("firebase-admin");
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;
const serviceAccount = require('./camera-app-firebase.json')

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});
// middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.zqjce.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

async function verifyToken(req, res, next) {
    if (req.headers?.authorization?.startsWith('Bearer ')) {
        const token = req.headers.authorization.split(' ')[1];

        try {
            const decodedUser = await admin.auth().verifyIdToken(token);
            req.decodedEmail = decodedUser.email;
        }
        catch {

        }

    }
    next();
}

async function run() {
    try {
        await client.connect();
        const database = client.db('cameraHouse');
        const productsCollection = database.collection('product');
        const reviewCollection = database.collection('review');
        const ordersCollection = database.collection('order');
        const usersCollection = database.collection('users');

        // GET All product
        app.get('/products', async (req, res) => {
            const cursor = productsCollection.find({});
            const products = await cursor.toArray();
            res.send(products);
        });

        // GET Single product
        app.get('/products/:id', async (req, res) => {
            const id = req.params.id;
            console.log('getting specific product', id);
            const query = { _id: ObjectId(id) };
            const product = await productsCollection.findOne(query);
            res.json(product);
        })

        // POST Single product
        app.post('/products', async (req, res) => {
            const product = req.body;
            console.log('hit the post api', product);

            const result = await productsCollection.insertOne(product);
            console.log(result);
            res.json(result)
        });
        // DELETE order
        app.delete('/products/:id', async (req, res) => {
            const id = req.params.id;
            console.log('id from server ',id)
            const query = { _id: ObjectId(id) };
            const result = await productsCollection.deleteOne(query);

            console.log('deleting user with id ', result);

            res.json(result);
        })

        // POST Single review
        app.post('/reviews', async (req, res) => {
            const review = req.body;
            console.log('hit the post api', review);

            const result = await reviewCollection.insertOne(review);
            console.log(result);
            res.json(result)
        });

        // GET All product
        app.get('/reviews', async (req, res) => {
            const cursor = reviewCollection.find({});
            const reviews = await cursor.toArray();
            res.send(reviews);
        });

        app.get('/users/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            let isAdmin = false;
            if (user?.role === 'admin') {
                isAdmin = true;
            }
            res.json({ admin: isAdmin });
        })

        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await usersCollection.insertOne(user);
            console.log(result);
            res.json(result);
        });

        app.put('/users', async (req, res) => {
            const user = req.body;
            const filter = { email: user.email };
            const options = { upsert: true };
            const updateDoc = { $set: user };
            const result = await usersCollection.updateOne(filter, updateDoc, options);
            res.json(result);
        });

        app.put('/users/admin', verifyToken, async (req, res) => {
            const user = req.body;
            const requester = req.decodedEmail;
            if (requester) {
                const requesterAccount = await usersCollection.findOne({ email: requester });
                if (requesterAccount.role === 'admin') {
                    const filter = { email: user.email };
                    const updateDoc = { $set: { role: 'admin' } };
                    const result = await usersCollection.updateOne(filter, updateDoc);
                    res.json(result);
                }
            }
            else {
                console.log('token error')
                res.status(403).json({ message: 'you do not have access to make admin' })
            }

        })

        // Get all orders my email
        app.get('/order/:email', async (req, res) => {
            const email = req.params.email;
            console.log(email);
            
            const query = { useremail: email };
            const cursor = ordersCollection.find(query);
            orders = await cursor.toArray();
            res.send(orders);
        });

        // Get all manage order
        app.get('/manageorder', async (req, res) => {
            const cursor = ordersCollection.find({});
            const orders = await cursor.toArray();
            res.send(orders);
        });
        // POST a order
        app.post('/order', async (req, res) => {
            let order = req.body;
            order['status']='pending';
            var today = new Date();
            var dd = String(today.getDate()).padStart(2, '0');
            var mm = String(today.getMonth() + 1).padStart(2, '0');
            var yyyy = today.getFullYear();

            today = mm + '/' + dd + '/' + yyyy;

            order['orderDate']=today;
            console.log('hit the post api', order);

            const result = await ordersCollection.insertOne(order);
            console.log(result);
            res.json(result)
        });

        //UPDATE order status
        app.put('/order/:id', async (req, res) => {
            const id = req.params.id;
            // const updatedUser = req.body;
            const {status} = req.body;
            const filter = { _id: ObjectId(id) };
            const options = { upsert: true };
            const updateDoc = {
                $set: { status },
            };
            const result = await ordersCollection.updateOne(filter, updateDoc, options)
            console.log('updating', id)
            res.json(result)
        })

        // DELETE order
        app.delete('/order/:id', async (req, res) => {
            const id = req.params.id;
            console.log('id from server ',id)
            const query = { _id: ObjectId(id) };
            const result = await ordersCollection.deleteOne(query);

            console.log('deleting user with id ', result);

            res.json(result);
        })

    }
    finally {
        // await client.close();
    }
}

run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Running camerahouse Server');
});

app.listen(port, () => {
    console.log('Running camerahouse Server on port', port);
})