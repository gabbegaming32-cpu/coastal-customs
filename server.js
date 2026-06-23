
import express from "express";
import http from "http";
import { Server } from "socket.io";
import { nanoid } from "nanoid";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";
import multer from "multer";

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const STAFF_PASSWORD = process.env.STAFF_PASSWORD || "coastal123";
const JWT_SECRET = process.env.JWT_SECRET || "change-this-secret";
const DATA = path.join(process.cwd(), "data");
const UPLOADS = path.join(process.cwd(), "public", "uploads");

fs.mkdirSync(DATA, { recursive:true });
fs.mkdirSync(UPLOADS, { recursive:true });

app.use(express.json({ limit:"12mb" }));
app.use(express.static("public"));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + nanoid(6) + path.extname(file.originalname).toLowerCase())
});
const upload = multer({ storage, limits:{ fileSize:8*1024*1024 } });

const f = (name) => path.join(DATA, name);
function read(name, fallback=[]) {
  try { return JSON.parse(fs.readFileSync(f(name), "utf8")); }
  catch { return fallback; }
}
function write(name, data) {
  fs.writeFileSync(f(name), JSON.stringify(data, null, 2));
}
function auth(req) {
  const raw = req.headers.authorization || "";
  const token = raw.startsWith("Bearer ") ? raw.slice(7) : "";
  if (!token) return null;
  try { return jwt.verify(token, JWT_SECRET); } catch { return null; }
}
function isStaff(req) {
  return req.headers["x-staff-password"] === STAFF_PASSWORD;
}
function gate(req, res) {
  if (!isStaff(req)) {
    res.status(401).json({ error:"Unauthorized" });
    return false;
  }
  return true;
}
function safeUser(u) {
  return { id:u.id, name:u.name, email:u.email, role:u.role||"customer", balance:Number(u.balance||0), createdAt:u.createdAt, banned:!!u.banned, discord:u.discord||null };
}
function sign(u) {
  return jwt.sign(safeUser(u), JWT_SECRET, { expiresIn:"14d" });
}

app.get(["/dashboard","/staff","/cart","/products","/product/:id"], (req,res) => {
  res.sendFile(path.join(process.cwd(), "public", "index.html"));
});

app.get("/api/settings", (req,res) => res.json(read("settings.json", {})));
app.get("/api/products", (req,res) => res.json(read("products.json").filter(p => p.status === "published")));
app.get("/api/products/:id", (req,res) => {
  const p = read("products.json").find(x => x.id === req.params.id);
  if (!p || p.status === "hidden") return res.status(404).json({ error:"Product not found" });
  res.json(p);
});
app.get("/api/reviews", (req,res) => res.json(read("reviews.json").filter(r => r.status === "approved")));

app.post("/api/auth/request-otp", (req,res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!email.includes("@")) return res.status(400).json({ error:"Valid email required" });
  const code = String(Math.floor(100000 + Math.random()*900000));
  const otps = read("otps.json");
  otps.push({ email, code, expiresAt:Date.now()+10*60*1000 });
  write("otps.json", otps);
  console.log(`\nCoastal Customs OTP for ${email}: ${code}\n`);
  res.json({ ok:true });
});

app.post("/api/auth/signup", async (req,res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const name = String(req.body?.name || "Customer").slice(0,40);
  const password = String(req.body?.password || "");
  const code = String(req.body?.code || "");
  const otps = read("otps.json");
  const valid = otps.find(o => o.email === email && o.code === code && o.expiresAt > Date.now());
  if (!valid) return res.status(400).json({ error:"Invalid or expired OTP" });
  if (password.length < 6) return res.status(400).json({ error:"Password must be 6+ characters" });

  const users = read("users.json");
  if (users.some(u => u.email === email)) return res.status(409).json({ error:"Account already exists" });

  const user = {
    id:nanoid(12),
    name,
    email,
    passwordHash: await bcrypt.hash(password, 10),
    role:"customer",
    balance:0,
    createdAt:new Date().toISOString(),
    banned:false,
    discord:null
  };
  users.push(user);
  write("users.json", users);
  write("otps.json", otps.filter(o => o !== valid));
  res.json({ token:sign(user), user:safeUser(user) });
});

app.post("/api/auth/login", async (req,res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  const user = read("users.json").find(u => u.email === email);
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ error:"Wrong email or password" });
  if (user.banned) return res.status(403).json({ error:"Account banned" });
  res.json({ token:sign(user), user:safeUser(user) });
});

app.get("/api/me", (req,res) => {
  const token = auth(req);
  if (!token) return res.status(401).json({ error:"Unauthorized" });
  const user = read("users.json").find(u => u.id === token.id);
  if (!user) return res.status(401).json({ error:"Unauthorized" });
  const orders = read("orders.json").filter(o => o.userId === user.id);
  const tickets = read("tickets.json").filter(t => t.userId === user.id);
  const transactions = read("transactions.json").filter(t => t.userId === user.id);
  res.json({ user:safeUser(user), orders, tickets, transactions });
});

app.post("/api/wallet/mock-topup", (req,res) => {
  const token = auth(req);
  if (!token) return res.status(401).json({ error:"Login required" });
  const amount = Number(req.body?.amount || 0);
  if (amount <= 0) return res.status(400).json({ error:"Invalid amount" });
  const users = read("users.json");
  const user = users.find(u => u.id === token.id);
  user.balance = Number((Number(user.balance || 0) + amount).toFixed(2));
  write("users.json", users);

  const tx = read("transactions.json");
  tx.unshift({ id:"TX-"+nanoid(8).toUpperCase(), userId:user.id, type:"wallet_topup", description:"Mock wallet top up", amount, createdAt:new Date().toISOString() });
  write("transactions.json", tx);
  res.json({ balance:user.balance });
});

app.post("/api/checkout/mock", (req,res) => {
  const token = auth(req);
  if (!token) return res.status(401).json({ error:"Login required" });
  const users = read("users.json");
  const user = users.find(u => u.id === token.id);
  const ids = Array.isArray(req.body?.items) ? req.body.items : [];
  const products = read("products.json").filter(p => ids.includes(p.id) && p.status === "published");
  if (!products.length) return res.status(400).json({ error:"Cart empty" });

  const total = Number(products.reduce((n,p) => n + Number(p.price || 0), 0).toFixed(2));
  const useBalance = !!req.body?.useBalance;
  if (useBalance) {
    if (Number(user.balance || 0) < total) return res.status(400).json({ error:"Not enough balance" });
    user.balance = Number((Number(user.balance) - total).toFixed(2));
    write("users.json", users);
  }

  const order = {
    id:"CC-"+nanoid(8).toUpperCase(),
    userId:user.id,
    email:user.email,
    status:"completed",
    provider:useBalance ? "wallet_mock" : "mock_checkout",
    total,
    items:products.map(p => ({ id:p.id, name:p.name, price:p.price, delivery:p.delivery, version:p.version, images:p.images||[] })),
    createdAt:new Date().toISOString()
  };
  const orders = read("orders.json");
  orders.unshift(order);
  write("orders.json", orders);

  const tx = read("transactions.json");
  tx.unshift({ id:"TX-"+nanoid(8).toUpperCase(), userId:user.id, type:"order", description:"Order "+order.id, amount:-total, createdAt:new Date().toISOString() });
  write("transactions.json", tx);

  res.json(order);
});

app.post("/api/tickets", (req,res) => {
  const token = auth(req);
  const body = req.body || {};
  if (!body.subject || !body.message) return res.status(400).json({ error:"Subject and message required" });
  const ticket = {
    id:"T-"+nanoid(8).toUpperCase(),
    userId:token?.id || null,
    name:String(token?.name || body.name || "Guest").slice(0,50),
    email:String(token?.email || body.email || "").slice(0,80),
    orderId:String(body.orderId || "").slice(0,50),
    subject:String(body.subject).slice(0,100),
    status:"open",
    priority:String(body.priority || "normal"),
    assignedTo:"",
    internalNotes:[],
    createdAt:new Date().toISOString(),
    messages:[{ from:"customer", name:String(token?.name || body.name || "Guest").slice(0,50), text:String(body.message).slice(0,1500), time:new Date().toISOString() }]
  };
  const tickets = read("tickets.json");
  tickets.unshift(ticket);
  write("tickets.json", tickets);
  io.to("staff").emit("ticket:new", ticket);
  res.json(ticket);
});

app.post("/api/reviews", (req,res) => {
  const token = auth(req);
  if (!token) return res.status(401).json({ error:"Login required" });
  const reviews = read("reviews.json");
  reviews.unshift({ id:"R-"+nanoid(8).toUpperCase(), name:token.name, rating:Math.max(1, Math.min(5, Number(req.body?.rating || 5))), text:String(req.body?.text || "").slice(0,600), status:"pending" });
  write("reviews.json", reviews);
  res.json({ ok:true });
});

/* ADMIN */
app.get("/api/admin/overview", (req,res) => {
  if (!gate(req,res)) return;
  const products = read("products.json");
  const users = read("users.json");
  const orders = read("orders.json");
  const tickets = read("tickets.json");
  const transactions = read("transactions.json");
  const reviews = read("reviews.json");
  res.json({
    stats:{
      revenue:Number(orders.reduce((n,o)=>n+Number(o.total||0),0).toFixed(2)),
      orders:orders.length,
      openTickets:tickets.filter(t=>t.status==="open").length,
      customers:users.length,
      products:products.length,
      walletBalance:Number(users.reduce((n,u)=>n+Number(u.balance||0),0).toFixed(2))
    },
    products,
    users:users.map(safeUser),
    orders,
    tickets,
    transactions,
    reviews,
    settings:read("settings.json",{})
  });
});

app.post("/api/admin/upload", upload.array("images", 8), (req,res) => {
  if (!gate(req,res)) return;
  res.json({ files:req.files.map(f => "/uploads/" + f.filename) });
});

app.post("/api/admin/products", (req,res) => {
  if (!gate(req,res)) return;
  const body = req.body || {};
  const products = read("products.json");
  const id = String(body.id || body.name || nanoid(8)).toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");

  const product = {
    id,
    name:String(body.name || "Untitled Product").slice(0,100),
    category:String(body.category || "Products").slice(0,60),
    price:Number(body.price || 0),
    badge:String(body.badge || "").slice(0,30),
    status:String(body.status || "published"),
    featured:body.featured === true || body.featured === "true",
    images:Array.isArray(body.images) ? body.images : [],
    short:String(body.short || "").slice(0,250),
    description:String(body.description || "").slice(0,4000),
    delivery:String(body.delivery || "").slice(0,4000),
    version:String(body.version || "1.0.0")
  };

  const i = products.findIndex(p => p.id === id);
  if (i >= 0) products[i] = product;
  else products.unshift(product);
  write("products.json", products);
  res.json(product);
});

app.delete("/api/admin/products/:id", (req,res) => {
  if (!gate(req,res)) return;
  write("products.json", read("products.json").filter(p => p.id !== req.params.id));
  res.json({ ok:true });
});

app.post("/api/admin/orders", (req,res) => {
  if (!gate(req,res)) return;
  const body = req.body || {};
  const users = read("users.json");
  const user = users.find(u => u.email === String(body.email||"").trim().toLowerCase() || u.id === body.userId);
  if (!user) return res.status(404).json({ error:"Customer not found" });
  const products = read("products.json").filter(p => (body.items||[]).includes(p.id));
  const total = Number(body.total || products.reduce((n,p)=>n+Number(p.price||0),0));
  const order = {
    id:"CC-"+nanoid(8).toUpperCase(),
    userId:user.id,
    email:user.email,
    status:body.status || "completed",
    provider:"manual_staff",
    total,
    items:products.map(p => ({ id:p.id, name:p.name, price:p.price, delivery:p.delivery, version:p.version, images:p.images||[] })),
    note:String(body.note || ""),
    createdAt:new Date().toISOString()
  };
  const orders = read("orders.json");
  orders.unshift(order);
  write("orders.json", orders);
  res.json(order);
});

app.post("/api/admin/users/:id/balance", (req,res) => {
  if (!gate(req,res)) return;
  const users = read("users.json");
  const user = users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error:"User not found" });
  const amount = Number(req.body?.amount || 0);
  user.balance = Number((Number(user.balance || 0) + amount).toFixed(2));
  write("users.json", users);
  const tx = read("transactions.json");
  tx.unshift({ id:"TX-"+nanoid(8).toUpperCase(), userId:user.id, type:"staff_adjustment", description:String(req.body?.description || "Staff balance adjustment"), amount, createdAt:new Date().toISOString() });
  write("transactions.json", tx);
  res.json(safeUser(user));
});

app.post("/api/admin/tickets/:id", (req,res) => {
  if (!gate(req,res)) return;
  const tickets = read("tickets.json");
  const ticket = tickets.find(t => t.id === req.params.id);
  if (!ticket) return res.status(404).json({ error:"Ticket not found" });
  if (req.body.status) ticket.status = req.body.status;
  if (req.body.priority) ticket.priority = req.body.priority;
  if (req.body.assignedTo !== undefined) ticket.assignedTo = req.body.assignedTo;
  if (req.body.internalNote) ticket.internalNotes.push({ text:String(req.body.internalNote).slice(0,1000), time:new Date().toISOString() });
  write("tickets.json", tickets);
  io.to("staff").emit("ticket:update", ticket);
  res.json(ticket);
});

app.post("/api/admin/reviews/:id", (req,res) => {
  if (!gate(req,res)) return;
  const reviews = read("reviews.json");
  const review = reviews.find(r => r.id === req.params.id);
  if (!review) return res.status(404).json({ error:"Review not found" });
  review.status = req.body.status || review.status;
  write("reviews.json", reviews);
  res.json(review);
});

app.post("/api/admin/settings", (req,res) => {
  if (!gate(req,res)) return;
  const next = { ...read("settings.json",{}), ...req.body };
  write("settings.json", next);
  res.json(next);
});

io.on("connection", socket => {
  socket.on("staff:join", pass => {
    if (pass === STAFF_PASSWORD) {
      socket.join("staff");
      socket.emit("staff:ready");
    } else socket.emit("staff:error", "Wrong staff password");
  });

  socket.on("ticket:join", id => socket.join("ticket:"+id));

  socket.on("ticket:message", ({ ticketId, text, name, password }) => {
    const tickets = read("tickets.json");
    const ticket = tickets.find(t => t.id === ticketId);
    if (!ticket || !text) return;
    const staff = password === STAFF_PASSWORD;
    const msg = {
      from:staff ? "staff" : "customer",
      name:staff ? "Coastal Support" : String(name || "Customer").slice(0,50),
      text:String(text).slice(0,1500),
      time:new Date().toISOString()
    };
    ticket.messages.push(msg);
    write("tickets.json", tickets);
    io.to("ticket:"+ticketId).emit("ticket:message", { ticketId, message:msg });
    io.to("staff").emit("ticket:update", ticket);
  });
});

server.listen(PORT, () => {
  console.log(`Coastal Customs V5 running at http://localhost:${PORT}`);
  console.log(`Staff panel: http://localhost:${PORT}/staff`);
});
