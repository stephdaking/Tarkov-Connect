const express = require('express');
const router = express.Router();
const pool = require('../modules/pool');
const moment = require('moment');

// This route will get all of the unread notifications
router.get('/notifications', (req, res) => {
	if (req.isAuthenticated()) {
		const queryText = `SELECT * FROM notifications WHERE receiver_user_id = $1 AND "isRead" = 1;`;
		pool
			.query(queryText, [req.user.id])
			.then((result) => {
				res.send(result.rows);
			})
			.catch((error) => {
				console.log(error);
				res.sendStatus(500);
			});
	} else {
		res.sendStatus(403);
	}
});

// This route will get the total of unread notifications
router.get('/totalNotifications', (req, res) => {
	if (req.isAuthenticated()) {
		const queryText = `SELECT sum(notifications."isRead") as total FROM notifications WHERE receiver_user_id = $1 AND "isRead" = 1;`;
		pool
			.query(queryText, [req.user.id])
			.then((result) => {
				res.send(result.rows);
			})
			.catch((error) => {
				console.log(error);
				res.sendStatus(500);
			});
	} else {
		res.sendStatus(403);
	}
});

// This route will get all the people a specific user has received a message from
router.get('/all', (req, res) => {
	if (req.isAuthenticated()) {
		let queryText = `SELECT DISTINCT ON ("user".tarkov_name) user_private_messages.message_id, private_messages.message, private_messages.time, private_messages.user_id, user_private_messages.sender_user_id, user_private_messages.receiver_user_id, "user".tarkov_name  FROM private_messages JOIN user_private_messages ON private_messages.id = user_private_messages.message_id JOIN "user" ON "user".id = user_private_messages.sender_user_id WHERE user_private_messages.receiver_user_id = $1 ORDER BY "user".tarkov_name, user_private_messages.message_id DESC;`;
		pool
			.query(queryText, [req.user.id])
			.then((result) => {
				res.send(result.rows);
			})
			.catch((error) => {
				console.log(error);
				res.sendStatus(500);
			});
	} else {
		res.sendStatus(403);
	}
});

// This route should return all of the messages in global
router.get('/', (req, res) => {
	if (req.isAuthenticated()) {
		let queryText = `SELECT messages.id, messages.description, messages.time, messages.user_id, "user".tarkov_name, "user"."socketId" FROM "messages" JOIN "user" ON "user".id = messages.user_id ORDER BY messages.id;`;
		pool
			.query(queryText)
			.then((result) => {
				res.send(result.rows);
			})
			.catch((error) => {
				console.log(error);
				res.sendStatus(500);
			});
	} else {
		res.sendStatus(403);
	}
});

//? This will post a new global message
router.post('/', (req, res) => {
	const timePosted = moment().format('LLL');
	console.log('THIS IS THE USER', req.user);
	if (req.isAuthenticated()) {
		let queryText = `INSERT INTO messages (description, time, user_id) VALUES ($1, $2, $3);`;
		pool
			.query(queryText, [req.body.message, timePosted, req.user.id])
			.then((result) => {
				res.sendStatus(200);
			})
			.catch((error) => {
				console.log('Error Posting new message', error);
				res.sendStatus(500);
			});
	} else {
		res.sendStatus(403);
	}
});

//? This will get all the private messages between the user and a user that was selected
router.get('/privateMessage/:id', (req, res) => {
	if (req.isAuthenticated()) {
		const id = req.params.id;
		let queryText = `SELECT private_messages.id, private_messages.message, private_messages.time, private_messages.user_id, user_private_messages.sender_user_id, user_private_messages.receiver_user_id, "user".tarkov_name, "user"."socketId" FROM private_messages JOIN user_private_messages ON private_messages.id = user_private_messages.message_id JOIN "user" ON "user".id = user_private_messages.sender_user_id WHERE user_private_messages.receiver_user_id = $1 AND user_private_messages.sender_user_id = $2 OR user_private_messages.sender_user_id = $1 AND user_private_messages.receiver_user_id = $2 ORDER BY private_messages.id;`;
		pool
			.query(queryText, [id, req.user.id])
			.then((result) => {
				res.send(result.rows);
			})
			.catch((error) => {
				console.log('Error getting a private messages', error);
				res.sendStatus(500);
			});
	} else {
		res.sendStatus(403);
	}
});

//? This will post a new private message between the user and a selected user
router.post('/privateMessage', async (req, res) => {
	const timePosted = moment().format('LLL');
	console.log('HERE IS YOUR PRIVATE MESSAGE POST', req.body);
	if (req.isAuthenticated()) {
		const queryText =
			'INSERT INTO private_messages (message, time, user_id) VALUES ($1, $2, $3) RETURNING id;';
		const messageResults = await pool.query(queryText, [req.body.message, timePosted, req.user.id]);
		const messageId = messageResults.rows[0].id;
		let junctionText = `INSERT INTO user_private_messages (message_id, sender_user_id, receiver_user_id) VALUES ($1, $2, $3);`;
		await pool
			.query(junctionText, [messageId, req.user.id, req.body.receiverId])
			.then((result) => {
				res.sendStatus(200);
			})
			.catch((error) => {
				console.log('Error posting new Private Message', error);
				res.sendStatus(500);
			});
	} else {
		res.sendStatus(403);
	}
});

//? This will update a message posted in global
router.put('/:id', (req, res) => {
	const id = req.params.id;
	const { message } = req.body;
	if (req.isAuthenticated()) {
		let queryText = `UPDATE messages SET description = $2 WHERE id = $1;`;
		pool
			.query(queryText, [id, message])
			.then((result) => {
				res.sendStatus(201);
			})
			.catch((error) => {
				console.log('ERROR DELETING', error);
				res.sendStatus(500);
			});
	} else {
		res.sendStatus(403);
	}
});

//? This will delete a message posted in global
router.delete('/:id', (req, res) => {
	const id = req.params.id;
	if (req.isAuthenticated()) {
		let queryText = `DELETE FROM messages WHERE id = $1;`;
		pool
			.query(queryText, [id])
			.then((result) => {
				res.sendStatus(201);
			})
			.catch((error) => {
				console.log('ERROR DELETING', error);
				res.sendStatus(500);
			});
	} else {
		res.sendStatus(403);
	}
});

// This route will set unread notification to read
router.put('/notifications/:id', (req, res) => {
	const id = req.params.id;
	if (req.isAuthenticated()) {
		const queryText = `UPDATE notifications SET "isRead" = 0 WHERE id = $1;`;
		pool
			.query(queryText, [id])
			.then((result) => {
				res.send(result.rows);
			})
			.catch((error) => {
				console.log(error);
				res.sendStatus(500);
			});
	} else {
		res.sendStatus(403);
	}
});

// This route will post a new notification
router.post('/notifications', (req, res) => {
	const { name, receiverId, message } = req.body;
	const timePosted = moment().format('LLL');
	if (req.isAuthenticated()) {
		const queryText = `INSERT INTO notifications ("from", message, "time", receiver_user_id) VALUES ($1, $2, $3, $4);`;
		pool
			.query(queryText, [name, message, timePosted, receiverId])
			.then((result) => {
				res.send(result.rows);
			})
			.catch((error) => {
				console.log(error);
				res.sendStatus(500);
			});
	} else {
		res.sendStatus(403);
	}
});

//? This route will update a private message
router.put('/privateMessage/:id', (req, res) => {
	const id = req.params.id;
	const { message } = req.body;
	if (req.isAuthenticated()) {
		let queryText = `UPDATE private_messages SET message = $2 WHERE id = $1;`;
		pool
			.query(queryText, [id, message])
			.then((result) => {
				res.sendStatus(201);
			})
			.catch((error) => {
				console.log('ERROR DELETING', error);
				res.sendStatus(500);
			});
	} else {
		res.sendStatus(403);
	}
});

//? This route will delete a private message
router.delete('/privateMessage/:id', (req, res) => {
	const id = req.params.id;
	if (req.isAuthenticated()) {
		let queryText = `DELETE FROM private_messages WHERE id = $1;`;
		pool
			.query(queryText, [id])
			.then((result) => {
				res.sendStatus(201);
			})
			.catch((error) => {
				console.log('ERROR DELETING', error);
				res.sendStatus(500);
			});
	} else {
		res.sendStatus(403);
	}
});

module.exports = router;
