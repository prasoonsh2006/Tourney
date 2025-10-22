const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

exports.manageAuctionState = functions.firestore
    .document('auctions/currentRacer')
    .onUpdate(async (change, context) => {

        const newRacerData = change.after.data();
        const previousRacerData = change.before.data();
        const db = admin.firestore();
        const auctionRef = db.collection('auctions').doc('currentRacer');

        if (newRacerData.currentBid !== previousRacerData.currentBid) {
            
            const timerEndsAt = newRacerData.timerEndsAt.toDate().getTime();
            const timeRemaining = timerEndsAt - Date.now();
            
            console.log(`Bid detected. Time remaining: ${timeRemaining / 1000}s`);

            if (timeRemaining <= 0) {
                return processWinner(newRacerData, db);
            }

            setTimeout(async () => {
                const finalState = await auctionRef.get();
                const finalData = finalState.data();

                if (finalData.lastBidderId === newRacerData.lastBidderId &&
                    finalData.currentBid === newRacerData.currentBid) {
                    
                    console.log("Auction timer ended. Processing winner.");
                    await processWinner(finalData, db);
                } else {
                    console.log("A new bid was placed. Auction timer reset on server.");
                }

            }, timeRemaining);
        }

        return null;
    });

async function processWinner(racerData, db) {
    const winnerId = racerData.lastBidderId;
    const soldPrice = racerData.currentBid;
    const racerName = racerData.name;
    const bidIncrement = racerData.bidIncrement;

    if (!winnerId || !soldPrice) {
        console.error("Missing winnerId or soldPrice. Automation aborted.");
        return null;
    }

    const winnerRef = db.collection('teams').doc(winnerId);
    const winnerDoc = await winnerRef.get();
    const winnerData = winnerDoc.data();
    const currentBalance = winnerData.balance;
    const newBalance = currentBalance - soldPrice;
    
    await winnerRef.update({ balance: newBalance });

    await winnerRef.collection('soldRacers').doc().set({
        racerName: racerName,
        soldPrice: soldPrice,
        soldDate: admin.firestore.FieldValue.serverTimestamp()
    });

    await db.collection('auctions').doc('currentRacer').update({
        name: "Next Racer",
        image: "https://via.placeholder.com/300x300.png?text=Next+Racer",
        basePrice: 500,
        bidIncrement: bidIncrement,
        currentBid: 500,
        lastBidderId: null,
        timerEndsAt: null,
    });

    console.log(`Auction for ${racerName} completed. Winner: ${winnerId}.`);
    return true;
}