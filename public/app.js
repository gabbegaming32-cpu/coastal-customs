
const socket = io();
const $ = id => document.getElementById(id);
let token = localStorage.cc_token || "";
let cart = JSON.parse(localStorage.cc_cart || "[]");
let me = null, products = [], reviews = [], settings = {}, staffPass = "", admin = null;

const icons = {
  user:`<svg class="icon" viewBox="0 0 24 24"><path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/></svg>`,
  cart:`<svg class="icon" viewBox="0 0 24 24"><path d="M6 6h15l-2 9H8L6 6Z"/><path d="M6 6 5 3H2"/><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></svg>`,
  grid:`<svg class="icon" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`,
  orders:`<svg class="icon" viewBox="0 0 24 24"><path d="M6 2h12v20l-3-2-3 2-3-2-3 2V2Z"/><path d="M9 7h6M9 11h6M9 15h4"/></svg>`,
  wallet:`<svg class="icon" viewBox="0 0 24 24"><path d="M3 7h18v13H3z"/><path d="M16 13h5"/><path d="M3 7l3-4h12l3 4"/></svg>`,
  download:`<svg class="icon" viewBox="0 0 24 24"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>`,
  ticket:`<svg class="icon" viewBox="0 0 24 24"><path d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4V7Z"/><path d="M13 5v14"/></svg>`,
  box:`<svg class="icon" viewBox="0 0 24 24"><path d="m21 8-9-5-9 5 9 5 9-5Z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/></svg>`,
  money:`<svg class="icon" viewBox="0 0 24 24"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6"/></svg>`,
  people:`<svg class="icon" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  star:`<svg class="icon" viewBox="0 0 24 24"><path d="m12 2 3 7 7 .6-5.3 4.6 1.6 6.8L12 17.3 5.7 21l1.6-6.8L2 9.6 9 9l3-7Z"/></svg>`,
  logout:`<svg class="icon" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></svg>`
};

function money(n){ return "$" + Number(n||0).toFixed(2); }
function saveCart(){ localStorage.cc_cart = JSON.stringify(cart); }
function logo(){ return `<img src="/assets/logo.png" onerror="this.style.display='none'">`; }
async function api(url, opts={}) {
  opts.headers = { ...(opts.headers||{}), "Content-Type":"application/json" };
  if (token) opts.headers.Authorization = "Bearer " + token;
  if (staffPass) opts.headers["x-staff-password"] = staffPass;
  const res = await fetch(url, opts);
  const json = await res.json().catch(()=>({}));
  if (!res.ok) throw new Error(json.error || "Request failed");
  return json;
}
function go(path){ history.pushState({}, "", path); route(); }
window.go = go;

async function boot(){
  settings = await api("/api/settings");
  products = await api("/api/products");
  reviews = await api("/api/reviews");
  try { me = await api("/api/me"); } catch {}
  route();
}
window.onpopstate = route;
document.addEventListener("click", e => {
  const a = e.target.closest("a");
  if (a && a.origin === location.origin) {
    e.preventDefault();
    history.pushState({}, "", a.href);
    route();
  }
});

function shell(content){
  $("app").innerHTML = `
  <div class="page">
    <nav class="nav">
      <a class="brand" href="/">
        ${logo()}
        <div class="brandText"><b>COASTAL CUSTOMS</b><span>ROBLOX DEVELOPMENT HUB</span></div>
      </a>
      <div class="links">
        <a href="/">HOME</a>
        <a href="/products">PRODUCTS</a>
        <a href="/dashboard">DASHBOARD</a>
        <a href="/staff">STAFF</a>
      </div>
      <div class="actions">
        <button class="iconbtn" onclick="authModal()">${icons.user}</button>
        <button class="iconbtn" onclick="go('/cart')">${icons.cart}</button>
        <a class="btn" href="${settings.discord || '#'}">JOIN DISCORD</a>
      </div>
    </nav>
    ${content}
    <footer class="footer">© Coastal Customs™ · Premium Roblox Development Marketplace</footer>
  </div>
  <div class="modal" id="modal"><div class="modalbox panel" id="modalbox"></div></div>`;
}
function route(){
  const p = location.pathname;
  if (p === "/dashboard") return dashboard();
  if (p === "/staff") return staffLogin();
  if (p === "/cart") return cartPage();
  if (p === "/products") return productsPage();
  if (p.startsWith("/product/")) return productPage(p.split("/").pop());
  home();
}

function home(){
  shell(`
  <main class="wrap">
    <section class="hero">
      <div class="eyebrow">COASTAL CUSTOMS</div>
      <h1>Premium Roblox<br>Development Assets</h1>
      <p>Systems, UI packs, scripts and development resources built for creators who want a clean professional experience.</p>
      <div class="row" style="justify-content:center;margin-top:28px">
        <a class="btn primary" href="/products">VIEW PRODUCTS</a>
        <a class="btn" href="/dashboard">CUSTOMER AREA</a>
      </div>
    </section>
    <section class="grid3">${products.filter(p=>p.featured).map(productCard).join("")}</section>
    <section class="section panel" style="margin-top:24px">
      <div class="space"><div><div class="eyebrow">WHY CHOOSE US</div><h2>Built for serious Roblox creators</h2></div></div>
      <div class="grid3">
        <div class="box">${icons.box}<h3>Premium Products</h3><p class="muted">Clean systems and assets that match modern Roblox project standards.</p></div>
        <div class="box">${icons.ticket}<h3>Support Included</h3><p class="muted">Customers can create tickets and your staff can handle them from /staff.</p></div>
        <div class="box">${icons.wallet}<h3>Customer Balance</h3><p class="muted">Wallet balance, orders, downloads and history inside a professional dashboard.</p></div>
      </div>
    </section>
  </main>`);
}
function productCard(p){
  const img = p.images?.[0];
  return `<article class="panel product">
    <a href="/product/${p.id}"><div class="thumb">${img ? `<img src="${img}">` : "C"}</div></a>
    <div class="body">
      <span class="badge">${p.badge || p.category}</span>
      <h2>${p.name}</h2>
      <p class="muted">${p.short || ""}</p>
      <div class="space"><b class="price">${money(p.price)}</b><button class="btn primary" onclick="addCart('${p.id}')">ADD TO CART</button></div>
    </div>
  </article>`;
}
window.addCart = id => { cart.push(id); saveCart(); alert("Added to cart"); };

function productsPage(){
  shell(`<main class="wrap"><section class="hero"><div class="eyebrow">MARKETPLACE</div><h1>Products</h1><p>Browse Coastal Customs development resources.</p></section><section class="grid3">${products.map(productCard).join("")}</section></main>`);
}
async function productPage(id){
  const p = await api("/api/products/"+id);
  const img = p.images?.[0];
  shell(`<main class="wrap"><section class="grid2"><div class="panel"><div class="thumb" style="height:470px">${img ? `<img src="${img}">` : "C"}</div></div><div class="panel box"><span class="badge">${p.category}</span><h1>${p.name}</h1><p class="muted">${p.description}</p><h2 class="price">${money(p.price)}</h2><div class="row"><button class="btn primary" onclick="addCart('${p.id}')">ADD TO CART</button><a class="btn" href="/cart">CHECKOUT</a></div><p class="muted">Version ${p.version}</p></div></section></main>`);
}
function cartPage(){
  const items = cart.map(id=>products.find(p=>p.id===id)).filter(Boolean);
  const total = items.reduce((n,p)=>n+Number(p.price),0);
  shell(`<main class="wrap"><section class="hero"><div class="eyebrow">YOUR CART</div><h1>Shopping Cart</h1><p>Review products and checkout securely.</p></section><section class="grid2"><div class="panel box">${items.length ? items.map((p,i)=>`<div class="listitem space"><div><b>${p.name}</b><br><span class="muted">${money(p.price)}</span></div><button class="btn small" onclick="cart.splice(${i},1);saveCart();route()">REMOVE</button></div>`).join("") : `<h2>Your cart is empty</h2><p class="muted">Add some products first.</p>`}</div><div class="panel box"><div class="eyebrow">CHECKOUT</div><h2>Your Order</h2><div class="space"><span>Subtotal</span><b>${money(total)}</b></div><br><button class="btn primary" onclick="checkout(false)">MOCK CHECKOUT</button><button class="btn" onclick="checkout(true)">PAY WITH BALANCE</button><p class="muted">Stripe and SellAuth can be connected after the design is approved.</p></div></section></main>`);
}
window.checkout = async useBalance => {
  try {
    const order = await api("/api/checkout/mock",{method:"POST",body:JSON.stringify({items:cart,useBalance})});
    cart=[]; saveCart();
    alert("Order created: " + order.id);
    me = await api("/api/me");
    go("/dashboard");
  } catch(e){ alert(e.message); }
};

function authModal(){
  const modal = $("modal"), box = $("modalbox");
  box.innerHTML = me ? `<h2>${me.user.name}</h2><p class="muted">${me.user.email}</p><button class="btn primary" onclick="go('/dashboard')">OPEN DASHBOARD</button><button class="btn" onclick="localStorage.removeItem('cc_token');location.reload()">LOGOUT</button>` :
  `<h2>Customer Login</h2><input id="le" placeholder="Email"><input id="lp" type="password" placeholder="Password"><button class="btn primary" onclick="login()">LOGIN</button><br><br><h3>Create Account</h3><input id="sn" placeholder="Name"><input id="se" placeholder="Email"><button class="btn" onclick="otp()">SEND OTP</button><input id="so" placeholder="OTP from Terminal"><input id="sp" type="password" placeholder="Password"><button class="btn primary" onclick="signup()">CREATE ACCOUNT</button>`;
  modal.classList.add("show");
  modal.onclick = e => { if(e.target.id === "modal") modal.classList.remove("show"); };
}
window.authModal = authModal;
window.otp = async()=>{ await api("/api/auth/request-otp",{method:"POST",body:JSON.stringify({email:$("se").value})}); alert("OTP printed in Terminal"); };
window.signup = async()=>{ const r=await api("/api/auth/signup",{method:"POST",body:JSON.stringify({name:$("sn").value,email:$("se").value,code:$("so").value,password:$("sp").value})}); localStorage.cc_token=r.token; location.reload(); };
window.login = async()=>{ const r=await api("/api/auth/login",{method:"POST",body:JSON.stringify({email:$("le").value,password:$("lp").value})}); localStorage.cc_token=r.token; location.reload(); };

async function dashboard(){
  try { me = await api("/api/me"); } catch {
    return shell(`<main class="wrap"><section class="panel box"><h1>Login Required</h1><p class="muted">Log in to access your customer dashboard.</p><button class="btn primary" onclick="authModal()">LOGIN</button></section></main>`);
  }
  const u=me.user,total=me.orders.reduce((n,o)=>n+Number(o.total),0);
  shell(`<main class="wrap"><section class="hero"><div class="eyebrow">CUSTOMER AREA</div><h1 id="dashTitle">Dashboard</h1><p>Track orders, spending, account history, balance and support tickets.</p></section><section class="dash"><aside class="panel sidebar"><div class="account"><div class="avatar">${icons.user}</div><div><div class="eyebrow">CUSTOMER DASHBOARD</div><h2>MY ACCOUNT</h2><p class="muted">${u.email}</p></div></div><button class="sidebtn active" onclick="dashTab('dashboard')">${icons.grid} DASHBOARD</button><button class="sidebtn" onclick="dashTab('orders')">${icons.orders} ORDERS</button><button class="sidebtn" onclick="dashTab('balance')">${icons.wallet} BALANCE</button><button class="sidebtn" onclick="dashTab('downloads')">${icons.download} DOWNLOADS</button><button class="sidebtn" onclick="dashTab('tickets')">${icons.ticket} TICKETS</button><button class="sidebtn" onclick="localStorage.removeItem('cc_token');location.reload()">${icons.logout} LOGOUT</button></aside><section class="main" id="dashMain"></section></section></main>`);
  dashTab("dashboard");
}
window.dashTab = tab => {
  document.querySelectorAll(".sidebtn").forEach(x=>x.classList.remove("active"));
  event?.target?.closest(".sidebtn")?.classList.add("active");
  $("dashTitle").textContent = tab.toUpperCase();
  const u=me.user,total=me.orders.reduce((n,o)=>n+Number(o.total),0),d=$("dashMain");
  if(tab==="dashboard") d.innerHTML = `<div class="grid4"><div class="panel stat"><div class="statIcon">${icons.orders}</div><h3>Completed Orders</h3><b>${me.orders.length}</b></div><div class="panel stat"><div class="statIcon">${icons.money}</div><h3>Total Spent</h3><b>${money(total)}</b></div><div class="panel stat"><div class="statIcon">${icons.wallet}</div><h3>Balance</h3><b>${money(u.balance)}</b></div><div class="panel stat"><div class="statIcon">${icons.ticket}</div><h3>Open Tickets</h3><b>${me.tickets.filter(x=>x.status==="open").length}</b></div></div><div class="grid2" style="margin-top:22px"><div class="panel section"><div class="eyebrow">LATEST ORDER</div>${me.orders[0]?`<h3>${me.orders[0].id}</h3><p class="muted">${new Date(me.orders[0].createdAt).toLocaleDateString()}</p>`:"<p class='muted'>No orders yet.</p>"}</div><div class="panel section"><div class="eyebrow">BALANCE</div><h2>${money(u.balance)}</h2><button class="btn primary" onclick="dashTab('balance')">TOP UP</button></div></div>`;
  if(tab==="orders") d.innerHTML = `<div class="panel section"><div class="eyebrow">HISTORY</div><h2>Your Orders</h2><table><tr><th>Status</th><th>ID</th><th>Products</th><th>Price</th><th>Date</th></tr>${me.orders.map(o=>`<tr><td><span class="pill">${o.status}</span></td><td>${o.id}</td><td>${o.items.map(i=>i.name).join(", ")}</td><td>${money(o.total)}</td><td>${new Date(o.createdAt).toLocaleDateString()}</td></tr>`).join("")}</table></div>`;
  if(tab==="balance") d.innerHTML = `<div class="grid2"><div class="panel box"><h3>BALANCE</h3><p class="muted">Customer balance can be used to pay for future orders.</p><h1>${money(u.balance)}</h1></div><div class="panel box"><h3>TOP UP</h3><p class="muted">Mock top up for local testing.</p><div class="topup">${[5,10,25,50,100].map(a=>`<button class="btn primary" onclick="topup(${a})">${money(a)}</button>`).join("")}</div></div></div><div class="panel section" style="margin-top:22px"><h2>Transaction History</h2><table><tr><th>ID</th><th>Type</th><th>Description</th><th>Amount</th><th>Date</th></tr>${me.transactions.map(x=>`<tr><td>${x.id}</td><td>${x.type}</td><td>${x.description}</td><td>${money(x.amount)}</td><td>${new Date(x.createdAt).toLocaleDateString()}</td></tr>`).join("")}</table></div>`;
  if(tab==="downloads") d.innerHTML = `<div class="panel section"><h2>Downloads</h2>${me.orders.flatMap(o=>o.items.map(i=>`<div class="listitem"><b>${i.name}</b><p class="muted">${i.delivery}</p></div>`)).join("") || "<p class='muted'>No downloads yet.</p>"}</div>`;
  if(tab==="tickets") {
    d.innerHTML = `<div class="grid2"><div class="panel box"><h2>Open Ticket</h2><form id="ticketForm"><input name="subject" placeholder="Subject"><input name="orderId" placeholder="Order ID"><select name="priority"><option>normal</option><option>high</option><option>urgent</option></select><textarea name="message" placeholder="Message"></textarea><button class="btn primary">CREATE TICKET</button></form></div><div class="panel box"><h2>Your Tickets</h2>${me.tickets.map(t=>`<div class="listitem" onclick="openTicket('${t.id}')"><b>${t.subject}</b><br><span class="muted">${t.id} · ${t.status}</span></div>`).join("")}</div></div><div id="ticketChat"></div>`;
    $("ticketForm").onsubmit = async e => { e.preventDefault(); await api("/api/tickets",{method:"POST",body:JSON.stringify(Object.fromEntries(new FormData(e.target)))}); me=await api("/api/me"); dashTab("tickets"); };
  }
};
window.topup = async a => { await api("/api/wallet/mock-topup",{method:"POST",body:JSON.stringify({amount:a})}); me=await api("/api/me"); dashTab("balance"); };
window.openTicket = id => {
  const t=me.tickets.find(x=>x.id===id);
  $("ticketChat").innerHTML = `<div class="panel section"><h2>${t.subject}</h2><div class="messages" id="msgs">${t.messages.map(m=>`<div class="msg ${m.from}"><b>${m.name}</b><br>${m.text}</div>`).join("")}</div><form id="replyForm" class="row"><input id="replyInput" placeholder="Reply"><button class="btn primary">SEND</button></form></div>`;
  socket.emit("ticket:join",id);
  $("replyForm").onsubmit = e => { e.preventDefault(); socket.emit("ticket:message",{ticketId:id,name:me.user.name,text:$("replyInput").value}); $("replyInput").value=""; };
};

/* STAFF */
function staffLogin(){
  shell(`<main class="wrap"><section class="panel box" style="max-width:560px;margin:auto"><div class="eyebrow">STAFF ACCESS</div><h1>Staff Panel</h1><p class="muted">Hidden panel at /staff.</p><input id="spass" type="password" placeholder="Staff password"><button class="btn primary" onclick="staffEnter()">ENTER PANEL</button></section></main>`);
}
window.staffEnter = async () => {
  staffPass = $("spass").value;
  admin = await api("/api/admin/overview");
  socket.emit("staff:join", staffPass);
  staffPanel();
};
function staffPanel(){
  shell(`<main class="wrap"><section class="hero"><div class="eyebrow">ADMIN AREA</div><h1 id="staffTitle">Overview</h1><p>Manage products, orders, customers, balance, tickets, reviews and uploads.</p></section><section class="dash"><aside class="panel sidebar"><button class="sidebtn active" onclick="staffTab('overview')">${icons.grid} OVERVIEW</button><button class="sidebtn" onclick="staffTab('products')">${icons.box} PRODUCTS</button><button class="sidebtn" onclick="staffTab('orders')">${icons.cart} ORDERS</button><button class="sidebtn" onclick="staffTab('customers')">${icons.people} CUSTOMERS</button><button class="sidebtn" onclick="staffTab('tickets')">${icons.ticket} TICKETS</button><button class="sidebtn" onclick="staffTab('reviews')">${icons.star} REVIEWS</button></aside><section class="main" id="staffMain"></section></section></main>`);
  staffTab("overview");
}
window.staffTab = tab => {
  document.querySelectorAll(".sidebtn").forEach(x=>x.classList.remove("active"));
  event?.target?.closest(".sidebtn")?.classList.add("active");
  $("staffTitle").textContent = tab.toUpperCase();
  const d=$("staffMain"), s=admin.stats;
  if(tab==="overview") d.innerHTML = `<div class="grid4"><div class="panel stat"><div class="statIcon">${icons.money}</div><h3>Revenue</h3><b>${money(s.revenue)}</b></div><div class="panel stat"><div class="statIcon">${icons.orders}</div><h3>Orders</h3><b>${s.orders}</b></div><div class="panel stat"><div class="statIcon">${icons.ticket}</div><h3>Open Tickets</h3><b>${s.openTickets}</b></div><div class="panel stat"><div class="statIcon">${icons.people}</div><h3>Customers</h3><b>${s.customers}</b></div></div>`;
  if(tab==="products") d.innerHTML = `<div class="space"><h2>Product Manager</h2><button class="btn primary" onclick="editProduct('')">NEW PRODUCT</button></div><div class="grid2"><div>${admin.products.map(p=>`<div class="listitem" onclick="editProduct('${p.id}')"><b>${p.name}</b><br><span class="muted">${money(p.price)} · ${p.status}</span></div>`).join("")}</div><div id="productEditor"></div></div>`;
  if(tab==="orders") {
    d.innerHTML = `<div class="panel box"><h2>Create Manual Order</h2><form id="orderForm"><input name="email" placeholder="Customer email"><select name="items" multiple>${admin.products.map(p=>`<option value="${p.id}">${p.name}</option>`).join("")}</select><input name="total" type="number" step="0.01" placeholder="Total optional"><textarea name="note" placeholder="Internal note"></textarea><button class="btn primary">CREATE ORDER</button></form></div><div class="panel section" style="margin-top:22px"><h2>Orders</h2><table><tr><th>ID</th><th>Email</th><th>Total</th><th>Status</th></tr>${admin.orders.map(o=>`<tr><td>${o.id}</td><td>${o.email}</td><td>${money(o.total)}</td><td>${o.status}</td></tr>`).join("")}</table></div>`;
    $("orderForm").onsubmit = async e => { e.preventDefault(); const fd=new FormData(e.target); await api("/api/admin/orders",{method:"POST",body:JSON.stringify({email:fd.get("email"),items:fd.getAll("items"),total:fd.get("total"),note:fd.get("note")})}); admin=await api("/api/admin/overview"); staffTab("orders"); };
  }
  if(tab==="customers") d.innerHTML = `<div class="panel section"><h2>Customers</h2>${admin.users.map(u=>`<div class="listitem"><b>${u.name}</b> · ${u.email}<br><span class="muted">Balance: ${money(u.balance)}</span><div class="row"><input id="bal${u.id}" type="number" step="0.01" placeholder="Amount"><button class="btn primary" onclick="adjustBalance('${u.id}')">ADJUST BALANCE</button></div></div>`).join("")}</div>`;
  if(tab==="tickets") d.innerHTML = `<div class="grid2"><div>${admin.tickets.map(t=>`<div class="listitem" onclick="staffTicket('${t.id}')"><b>${t.subject}</b><br><span class="muted">${t.id} · ${t.status} · ${t.priority}</span></div>`).join("")}</div><div id="ticketEditor"></div></div>`;
  if(tab==="reviews") d.innerHTML = `<div class="panel section"><h2>Reviews</h2>${admin.reviews.map(r=>`<div class="listitem"><b>${r.name}</b> · ${"★".repeat(r.rating)}<p>${r.text}</p><span class="pill">${r.status}</span><br><br><button class="btn primary small" onclick="review('${r.id}','approved')">APPROVE</button><button class="btn danger small" onclick="review('${r.id}','hidden')">HIDE</button></div>`).join("")}</div>`;
};
window.editProduct = id => {
  const p=admin.products.find(x=>x.id===id)||{status:"published",featured:true,images:[],version:"1.0.0"};
  $("productEditor").innerHTML = `<div class="panel box"><h2>${id?"Edit":"New"} Product</h2><form id="productForm"><input name="id" value="${p.id||""}" placeholder="product-id"><input name="name" value="${p.name||""}" placeholder="Name"><input name="category" value="${p.category||""}" placeholder="Category"><input name="badge" value="${p.badge||""}" placeholder="Badge"><input name="price" value="${p.price||0}" type="number" step="0.01"><select name="status"><option ${p.status==="published"?"selected":""}>published</option><option ${p.status==="draft"?"selected":""}>draft</option><option ${p.status==="hidden"?"selected":""}>hidden</option></select><input name="version" value="${p.version||"1.0.0"}" placeholder="Version"><textarea name="short" placeholder="Short description">${p.short||""}</textarea><textarea name="description" placeholder="Full description">${p.description||""}</textarea><textarea name="delivery" placeholder="Delivery/download instructions">${p.delivery||""}</textarea><div class="fileHint"><b>Product Images</b><p class="muted">Upload images from your Mac. They will appear on the product card/page.</p><input id="imageFiles" type="file" multiple accept="image/*"><div class="gallery">${(p.images||[]).map(x=>`<img src="${x}">`).join("")}</div></div><button class="btn primary">SAVE PRODUCT</button>${id?`<button type="button" class="btn danger" onclick="deleteProduct('${id}')">DELETE</button>`:""}</form></div>`;
  $("productForm").onsubmit = async e => {
    e.preventDefault();
    const data=Object.fromEntries(new FormData(e.target));
    data.featured=true;
    data.images=p.images||[];
    const files=$("imageFiles").files;
    if(files.length){
      const fd=new FormData();
      [...files].forEach(file=>fd.append("images",file));
      const res=await fetch("/api/admin/upload",{method:"POST",headers:{"x-staff-password":staffPass},body:fd});
      const uploaded=await res.json();
      data.images=[...data.images,...uploaded.files];
    }
    await api("/api/admin/products",{method:"POST",body:JSON.stringify(data)});
    admin=await api("/api/admin/overview");
    staffTab("products");
  };
};
window.deleteProduct = async id => { if(confirm("Delete this product?")){ await api("/api/admin/products/"+id,{method:"DELETE"}); admin=await api("/api/admin/overview"); staffTab("products"); } };
window.adjustBalance = async id => { await api(`/api/admin/users/${id}/balance`,{method:"POST",body:JSON.stringify({amount:Number($("bal"+id).value),description:"Staff balance adjustment"})}); admin=await api("/api/admin/overview"); staffTab("customers"); };
window.review = async (id,status) => { await api(`/api/admin/reviews/${id}`,{method:"POST",body:JSON.stringify({status})}); admin=await api("/api/admin/overview"); staffTab("reviews"); };
window.staffTicket = id => {
  const t=admin.tickets.find(x=>x.id===id);
  $("ticketEditor").innerHTML = `<div class="panel box"><h2>${t.subject}</h2><p class="muted">${t.id} · ${t.email || "No email"}</p><div class="messages" id="staffMsgs">${t.messages.map(m=>`<div class="msg ${m.from}"><b>${m.name}</b><br>${m.text}</div>`).join("")}</div><form id="staffReply" class="row"><input id="staffReplyInput" placeholder="Reply"><button class="btn primary">SEND</button></form></div>`;
  socket.emit("ticket:join",id);
  $("staffReply").onsubmit = e => { e.preventDefault(); socket.emit("ticket:message",{ticketId:id,password:staffPass,text:$("staffReplyInput").value}); $("staffReplyInput").value=""; };
};
socket.on("ticket:message", ({message}) => {
  if($("msgs")) $("msgs").innerHTML += `<div class="msg ${message.from}"><b>${message.name}</b><br>${message.text}</div>`;
  if($("staffMsgs")) $("staffMsgs").innerHTML += `<div class="msg ${message.from}"><b>${message.name}</b><br>${message.text}</div>`;
});
boot();
