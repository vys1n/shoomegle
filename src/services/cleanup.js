const { collection, query, where, getDocs, deleteDoc } = require('firebase/firestore');
const { db } = require('./firebase.js');

async function cleanupStaleRooms() {
    console.log('[Cleanup] Checking for stale rooms...');
    try {
        const now = Date.now();
        const thirtySecondsAgo = new Date(now - 30000);
        const q = query(
            collection(db, 'waiting_queue'),
            where('status', '==', 'waiting')
        );

        const querySnapshot = await getDocs(q);
        const deletePromises = [];

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const createdAt = data.createdAt ? data.createdAt.toDate() : null;

            if (!createdAt || createdAt < thirtySecondsAgo) {
                deletePromises.push(deleteDoc(doc.ref));
            }
        });

        await Promise.all(deletePromises);

        if (deletePromises.length > 0) {
            console.log(`[Cleanup] Deleted ${deletePromises.length} stale rooms.`);
        }
    } catch (error) {
        console.error('[Cleanup] Error during stale room cleanup:', error);
    }
}

function startCleanupTask(intervalMs = 30000) {
    setInterval(cleanupStaleRooms, intervalMs);
    console.log(`[Cleanup] Background cleanup task started (Interval: ${intervalMs}ms)`);
}

module.exports = { startCleanupTask };
