const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
    await mongoose.connect(process.env.MONGODB_URI);
    const Organization = mongoose.model('Organization', new mongoose.Schema({
        orgId: String,
        name: String,
        orgIdBytes32: String,
        status: String,
        contractAddress: String
    }, { strict: false }));

    const res = await Organization.updateOne(
        { name: 'sample' },
        {
            $set: {
                status: 'Approved',
                orgIdBytes32: '0x7de4b3132ea2b4d8890399768122caef99cb4e106b16d527b4ce8a477ff1f082',
                contractAddress: '0x300A5CAdb32f52C9fA0C26bfC3735Bf83838Bb5D'
            }
        }
    );
    console.log('Update result:', res);
    process.exit(0);
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});
