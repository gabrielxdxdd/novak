const products = [
  {
    id: 1,
    type: "garment",
    group: "Sudaderas",
    name: "Sudadera boxy fit",
    description: "Sudadera 250 GSM en tela nacional de algodon, con capucha y bolsa frontal.",
    sizes: ["Mediana", "Grande"],
    colors: [
      {
        name: "Negro",
        value: "#111111",
        image: "negro.png",
        images: ["negro.png", "assets/negro-front.png", "assets/negro-back.png"],
      },
      {
        name: "Gris",
        value: "#d8d9de",
        image: "gris.png",
        images: ["gris.png", "assets/gris-front.png", "assets/gris-back.png"],
      },
      {
        name: "Hueso",
        value: "#eee8d7",
        image: "hueso.png",
        images: ["hueso.png", "assets/hueso-front.png", "assets/hueso-back.png"],
      },
      {
        name: "Marino",
        value: "#172238",
        image: "marino.png",
        images: ["marino.png", "assets/marino-front.png", "assets/marino-back.png"],
      },
    ],
    price: 199,
    priceTiers: [
      { from: 100, price: 139, label: "100+ piezas" },
      { from: 50, price: 149, label: "50-99 piezas" },
      { from: 25, price: 159, label: "25-49 piezas" },
      { from: 10, price: 179, label: "10-24 piezas" },
      { from: 5, price: 189, label: "5-9 piezas" },
      { from: 1, price: 199, label: "1-4 piezas" },
    ],
    image: "negro.png",
  },
];

const formatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

const productGrid = document.querySelector("#productGrid");
const cartPanel = document.querySelector("#cartPanel");
const productModal = document.querySelector("#productModal");
const overlay = document.querySelector("#overlay");
const cartItems = document.querySelector("#cartItems");
const cartCount = document.querySelector("#cartCount");
const cartTotal = document.querySelector("#cartTotal");
const modalTitle = document.querySelector("#modalTitle");
const modalUnitTotal = document.querySelector("#modalUnitTotal");
const modalPricePreview = document.querySelector("#modalPricePreview");
const modalProductImage = document.querySelector("#modalProductImage");
const selectedColorLabel = document.querySelector("#selectedColorLabel");
const colorOptions = document.querySelector("#colorOptions");
const sizeRows = document.querySelector("#sizeRows");
const openCart = document.querySelector("#openCart");
const closeCart = document.querySelector("#closeCart");
const closeModal = document.querySelector("#closeModal");
const modalAddButton = document.querySelector("#modalAddButton");
const checkoutButton = document.querySelector("#checkoutButton");
const galleryDots = document.querySelector("#galleryDots");
const modalGallery = document.querySelector(".modal-gallery");
const hero = document.querySelector(".hero");
const siteHeader = document.querySelector("#siteHeader");

const CART_STORAGE_KEY = "novak-cart-v1";
const IMAGE_FALLBACK = "assets/novak-logo.png";

let cart = [];
let selectedProduct = null;
let selectedColor = null;
let selectedColorIndex = 0;
let selectedImageIndex = 0;
let selectedQuantities = {};

function getColorImages(color) {
  if (color && Array.isArray(color.images) && color.images.length > 0) {
    return color.images;
  }
  return [color?.image].filter(Boolean);
}

function updateHeroParallax() {
  if (!hero) return;

  const bounds = hero.getBoundingClientRect();

  if (bounds.bottom < -120 || bounds.top > window.innerHeight + 120) return;

  const progress = Math.min(Math.max(window.scrollY / Math.max(bounds.height, 1), 0), 1);
  const offset = window.scrollY * 0.22;
  const scale = 1.08 + progress * 0.08;
  hero.style.setProperty("--hero-bg-y", `${offset.toFixed(1)}px`);
  hero.style.setProperty("--hero-bg-scale", scale.toFixed(3));
}

function updateHeaderState() {
  if (!siteHeader) return;

  siteHeader.classList.toggle("scrolled", window.scrollY > 12);
}

function initializeRevealAnimations() {
  const revealItems = document.querySelectorAll(".reveal, .reveal-card");

  if (!("IntersectionObserver" in window)) {
    revealItems.forEach((item) => item.classList.add("visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.16 }
  );

  revealItems.forEach((item) => observer.observe(item));
}

function getProductQuantity(productId) {
  return cart
    .filter(
      (item) =>
        item.product.id === productId &&
        item.type === "garment"
    )
    .reduce((total, item) => total + item.quantity, 0);
}

function getPriceTier(product, quantity) {
  return (
    product.priceTiers.find((tier) => quantity >= tier.from) ||
    product.priceTiers.at(-1)
  );
}

function getNextPriceTier(product, quantity) {
  return [...product.priceTiers]
    .sort((a, b) => a.from - b.from)
    .find((tier) => tier.from > quantity);
}

function getGarmentUnitPrice(product, addedQuantity = 0) {
  const totalQuantity = getProductQuantity(product.id) + addedQuantity;

  return getPriceTier(product, totalQuantity).price;
}

function getUnitPrice(item) {
  return getGarmentUnitPrice(item.product);
}

function getCartTotal() {
  return cart.reduce((sum, item) => {
    return sum + getUnitPrice(item) * item.quantity;
  }, 0);
}

function getItemKey(productId, color, size) {
  return `${productId}-${color}-${size}`;
}

function getProductImage(product, colorName = product.colors?.[0]?.name) {
  return (
    product.colors?.find((color) => color.name === colorName)?.image ||
    product.image
  );
}

function saveCart() {
  try {
    const payload = cart.map((item) => ({
      key: item.key,
      type: item.type,
      productId: item.product.id,
      color: item.color,
      size: item.size,
      quantity: item.quantity,
    }));
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* storage full or unavailable */
  }
}

function loadCart() {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];

    return JSON.parse(raw)
      .map((entry) => {
        const product = products.find((item) => item.id === entry.productId);
        if (!product) return null;

        return {
          key: entry.key,
          type: entry.type,
          product,
          color: entry.color,
          size: entry.size,
          quantity: entry.quantity,
        };
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function setModalColor(color) {
  selectedColor = color;
  selectedColorIndex = selectedProduct.colors.findIndex(
    (item) => item.name === color.name
  );
  if (selectedColorIndex < 0) selectedColorIndex = 0;
  selectedImageIndex = 0;

  modalTitle.textContent = `${selectedProduct.name} ${selectedColor.name}`;
  renderGarmentModal();
}

function shiftModalImage(delta) {
  if (!selectedColor) return;

  const images = getColorImages(selectedColor);
  if (images.length === 0) return;

  selectedImageIndex =
    (selectedImageIndex + delta + images.length) % images.length;
  renderGarmentModal();
}

function renderColorSwatches(colors, selectedName) {
  return colors
    .map(
      (color) => `
        <button
          class="color-swatch ${color.name === selectedName ? "active" : ""}"
          type="button"
          data-color="${color.name}"
          style="--swatch-color: ${color.value};"
          aria-label="${color.name}"
          title="${color.name}"
        >
          <span></span>
          <strong>${color.name}</strong>
        </button>
      `
    )
    .join("");
}

function getLowestUnitPrice(product) {
  return Math.min(...product.priceTiers.map((tier) => tier.price));
}

function renderGarmentProduct(product) {
  const priceRows = [...product.priceTiers]
    .sort((a, b) => a.from - b.from)
    .map(
      (tier) => `
        <tr>
          <td>${tier.label}</td>
          <td>${formatter.format(tier.price)}</td>
        </tr>
      `
    )
    .join("");

  return `
    <div class="catalog-intro">
      <div class="price-table catalog-price-table">
        <div>
          <p class="eyebrow">Precios por volumen</p>
          <h3>Mientras mas piezas agregas, mejor precio recibe tu pedido.</h3>
        </div>
        <table>
          <thead>
            <tr>
              <th>Cantidad</th>
              <th>Precio por pieza</th>
            </tr>
          </thead>
          <tbody>
            ${priceRows}
          </tbody>
        </table>
      </div>
    </div>
    <div class="product-color-grid">
      ${product.colors
        .map(
          (color) => `
            <article class="catalog-card" style="--swatch-color: ${color.value};">
              <span class="offer-badge">NOVAK</span>
              <button class="catalog-image-button" type="button" data-id="${product.id}" data-color="${color.name}" aria-label="Elegir ${product.name} color ${color.name}">
                <img src="${color.image}" alt="${product.name} color ${color.name}" loading="lazy" onerror="this.onerror=null;this.src='${IMAGE_FALLBACK}'">
              </button>
              <div class="catalog-card-body">
                <div>
                  <p class="catalog-color">${color.name}</p>
                  <h4>${product.name}</h4>
                </div>
                <div class="catalog-price">
                  <strong>${formatter.format(product.price)}</strong>
                  <span>Desde ${formatter.format(getLowestUnitPrice(product))} por volumen</span>
                </div>
                <button class="add-button catalog-add-button" type="button" data-id="${product.id}" data-color="${color.name}">
                  Agregar al carrito
                </button>
              </div>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function renderProducts() {
  productGrid.innerHTML = products
    .map(
      (product) => `
        <section class="product-group reveal-card" aria-labelledby="grupo-${product.id}">
          <div class="product-group-heading">
            <p class="eyebrow">Categoria</p>
            <h3 id="grupo-${product.id}">${product.group}</h3>
          </div>
          ${renderGarmentProduct(product)}
        </section>
      `
    )
    .join("");
}

function renderCart() {
  const itemCount = cart.reduce((total, item) => total + item.quantity, 0);
  const productSummaries = products
    .map((product) => {
      const productQuantity = getProductQuantity(product.id);
      const summaries = [];

      if (productQuantity > 0) {
        summaries.push({
          label: product.name,
          quantity: productQuantity,
          unit: "pieza(s)",
          unitPrice: getGarmentUnitPrice(product),
          tierLabel: getPriceTier(product, productQuantity).label,
        });
      }

      return summaries;
    })
    .flat()
    .filter((summary) => summary.quantity > 0);

  cartCount.textContent = itemCount;
  cartTotal.textContent = formatter.format(getCartTotal());

  if (cart.length === 0) {
    cartItems.innerHTML = '<p class="empty-cart">Tu carrito esta vacio.</p>';
    return;
  }

  const summaryHtml = productSummaries
    .map(
      (summary) => `
        <div class="cart-summary">
          <strong>${summary.label}: ${summary.quantity} ${summary.unit}</strong>
          <span>Rango aplicado: ${summary.tierLabel}</span>
          <span>Precio usado: ${formatter.format(summary.unitPrice)} c/u</span>
        </div>
      `
    )
    .join("");

  const itemsHtml = cart
    .map((item) => {
      const unitPrice = getUnitPrice(item);
      const totalByProduct = getProductQuantity(item.product.id);
      const tier = getPriceTier(item.product, totalByProduct);

      return `
        <article class="cart-item">
          <img src="${getProductImage(item.product, item.color)}" alt="${item.product.name} ${item.color}" onerror="this.onerror=null;this.src='${IMAGE_FALLBACK}'">
          <div>
            <h3>${item.product.name}</h3>
            <p>${item.color} - ${item.size}</p>
            <p>${item.quantity} x ${formatter.format(unitPrice)}</p>
            <p>Rango aplicado: ${tier.label}</p>
            <div class="quantity-controls">
              <button type="button" data-action="decrease" data-key="${item.key}">-</button>
              <span>${item.quantity}</span>
              <button type="button" data-action="increase" data-key="${item.key}">+</button>
            </div>
          </div>
          <button class="remove-button" type="button" data-action="remove" data-key="${item.key}">
            Quitar
          </button>
        </article>
      `;
    })
    .join("");

  cartItems.innerHTML = summaryHtml + itemsHtml;
}

function renderGarmentModal() {
  const total = Object.values(selectedQuantities).reduce(
    (sum, quantity) => sum + quantity,
    0
  );
  const projectedProductTotal =
    getProductQuantity(selectedProduct.id) + total;
  const projectedUnitPrice = getGarmentUnitPrice(selectedProduct, total);
  const reachesWholesale =
    projectedProductTotal > 0;
  const nextTier = getNextPriceTier(selectedProduct, projectedProductTotal);

  selectedColorLabel.textContent = `${selectedProduct.name} - ${selectedColor.name}`;
  const colorImages = getColorImages(selectedColor);
  if (selectedImageIndex >= colorImages.length) selectedImageIndex = 0;
  const currentImage = colorImages[selectedImageIndex] || selectedColor.image;
  modalProductImage.onerror = () => {
    modalProductImage.onerror = null;
    modalProductImage.src = IMAGE_FALLBACK;
  };
  modalProductImage.src = currentImage;
  modalProductImage.alt = `${selectedProduct.name} ${selectedColor.name}`;
  colorOptions.innerHTML = renderColorSwatches(
    selectedProduct.colors,
    selectedColor.name
  );

  if (galleryDots) {
    galleryDots.innerHTML = colorImages
      .map(
        (_, index) => `
          <button
            type="button"
            class="${index === selectedImageIndex ? "active" : ""}"
            data-image-index="${index}"
            aria-label="Foto ${index + 1}"
            aria-current="${index === selectedImageIndex ? "true" : "false"}"
          ></button>
        `
      )
      .join("");
  }

  sizeRows.innerHTML = `
    ${selectedProduct.sizes
      .map(
        (size) => `
          <div class="size-row">
            <span>${size}</span>
            <div class="modal-quantity">
              <button type="button" data-modal-action="decrease" data-size="${size}">-</button>
              <span>${selectedQuantities[size]}</span>
              <button type="button" data-modal-action="increase" data-size="${size}">+</button>
            </div>
          </div>
        `
      )
      .join("")}
  `;
  modalUnitTotal.textContent = total;
  modalPricePreview.textContent = reachesWholesale
    ? nextTier
      ? `Precio por pieza al agregar: ${formatter.format(projectedUnitPrice)} (${projectedProductTotal} ${selectedProduct.name.toLowerCase()} en total). Faltan ${nextTier.from - projectedProductTotal} para ${formatter.format(nextTier.price)} c/u.`
      : `Precio por pieza al agregar: ${formatter.format(projectedUnitPrice)} (${projectedProductTotal} ${selectedProduct.name.toLowerCase()} en total). Mejor rango aplicado.`
    : `Precio por pieza: ${formatter.format(selectedProduct.price)}.`;
  modalAddButton.disabled = total === 0;
}

function renderModal() {
  renderGarmentModal();
}

function getColorSlug(colorName) {
  return colorName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "-");
}

function openProductModal(productId, colorName) {
  selectedProduct = products.find((item) => item.id === productId);
  selectedColor =
    selectedProduct.colors.find((color) => color.name === colorName) ||
    selectedProduct.colors[0];
  selectedColorIndex = selectedProduct.colors.findIndex(
    (color) => color.name === selectedColor.name
  );
  if (selectedColorIndex < 0) selectedColorIndex = 0;
  selectedImageIndex = 0;
  selectedQuantities = Object.fromEntries(
    selectedProduct.sizes.map((size) => [size, 0])
  );

  modalTitle.textContent = `${selectedProduct.name} ${selectedColor.name}`;
  renderModal();
  productModal.classList.add("open");
  overlay.classList.add("open");
  productModal.setAttribute("aria-hidden", "false");

  history.replaceState(
    null,
    "",
    `#producto-${productId}-${getColorSlug(selectedColor.name)}`
  );
}

function closeProductModal() {
  productModal.classList.remove("open");
  productModal.setAttribute("aria-hidden", "true");

  if (!cartPanel.classList.contains("open")) {
    overlay.classList.remove("open");
  }

  history.replaceState(null, "", window.location.pathname + window.location.search);
}

function addModalSelectionToCart() {
  const color = selectedColor.name;
  const entries = Object.entries(selectedQuantities).filter(
    ([, quantity]) => quantity > 0
  );

  entries.forEach(([size, quantity]) => {
    const key = getItemKey(selectedProduct.id, color, size);
    const cartItem = cart.find((item) => item.key === key);

    if (cartItem) {
      cartItem.quantity += quantity;
    } else {
      cart.push({
        key,
        type: "garment",
        product: selectedProduct,
        color,
        size,
        quantity,
      });
    }
  });

  renderCart();
  saveCart();
  closeProductModal();
  showCart();
}

function updateCartQuantity(key, change) {
  const cartItem = cart.find((item) => item.key === key);

  if (!cartItem) return;

  cartItem.quantity += change;
  if (cartItem.quantity <= 0) cart = cart.filter((item) => item.key !== key);

  renderCart();
  saveCart();
}

function removeFromCart(key) {
  cart = cart.filter((item) => item.key !== key);
  renderCart();
  saveCart();
}

function buildWhatsAppMessage() {
  const groupedBlocks = products
    .map((product) => {
      const productItems = cart.filter((item) => item.product.id === product.id);
      if (productItems.length === 0) return "";

      const productQuantity = getProductQuantity(product.id);
      const unitPrice = getGarmentUnitPrice(product);
      const priceType = getPriceTier(product, productQuantity).label;
      const subtotal = productQuantity * unitPrice;
      const variants = productItems
        .map(
          (item) =>
            `   • ${item.color} - talla ${item.size}: ${item.quantity} pza(s)`
        )
        .join("\n");

      return [
        `*${product.name}*`,
        `   Cantidad total: ${productQuantity} pieza(s)`,
        `   Precio por pieza: ${formatter.format(unitPrice)} (${priceType})`,
        `   Subtotal: ${formatter.format(subtotal)}`,
        ``,
        `   Detalle:`,
        variants,
      ].join("\n");
    })
    .filter(Boolean);

  const lines = [
    "Hola, quiero cotizar este pedido de NOVAK:",
    "",
    "----------------------------------",
    "",
    groupedBlocks.join("\n\n----------------------------------\n\n"),
    "",
    "----------------------------------",
    "",
    `*Total aproximado:* ${cartTotal.textContent}`,
    "",
    "Quiero confirmar disponibilidad, pago, envio o entrega personal.",
  ];

  return lines.join("\n");
}

function requestOrder() {
  if (cart.length === 0) {
    alert("Agrega al menos un producto al carrito para pedir por WhatsApp.");
    return;
  }

  const phone = "522217681197";
  const message = encodeURIComponent(buildWhatsAppMessage());
  window.open(`https://wa.me/${phone}?text=${message}`, "_blank");
}

function showCart() {
  cartPanel.classList.add("open");
  overlay.classList.add("open");
  cartPanel.setAttribute("aria-hidden", "false");
}

function hideCart() {
  cartPanel.classList.remove("open");
  cartPanel.setAttribute("aria-hidden", "true");

  if (!productModal.classList.contains("open")) {
    overlay.classList.remove("open");
  }
}

productGrid.addEventListener("click", (event) => {
  const button = event.target.closest(".add-button");

  if (button) {
    openProductModal(Number(button.dataset.id), button.dataset.color);
    return;
  }

  const imageButton = event.target.closest(".catalog-image-button");
  if (imageButton) {
    openProductModal(Number(imageButton.dataset.id), imageButton.dataset.color);
  }
});

colorOptions.addEventListener("click", (event) => {
  const swatch = event.target.closest(".color-swatch");

  if (!swatch || !selectedProduct) return;

  const color = selectedProduct.colors.find(
    (item) => item.name === swatch.dataset.color
  );
  if (color) setModalColor(color);
});

if (modalGallery) {
  modalGallery.addEventListener("click", (event) => {
    if (!selectedProduct) return;

    if (event.target.closest(".gallery-arrow-left")) {
      shiftModalImage(-1);
      return;
    }

    if (event.target.closest(".gallery-arrow-right")) {
      shiftModalImage(1);
      return;
    }

    const dot = event.target.closest("[data-image-index]");
    if (dot) {
      const index = Number(dot.dataset.imageIndex);
      const images = getColorImages(selectedColor);
      if (!Number.isNaN(index) && images[index]) {
        selectedImageIndex = index;
        renderGarmentModal();
      }
    }
  });
}

sizeRows.addEventListener("click", (event) => {
  const button = event.target.closest("button");

  if (!button) return;

  if (button.dataset.modalAction) {
    const size = button.dataset.size;
    const change = button.dataset.modalAction === "increase" ? 1 : -1;
    selectedQuantities[size] = Math.max(0, selectedQuantities[size] + change);
    renderModal();
  }

});

cartItems.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");

  if (!button) return;

  const key = button.dataset.key;

  if (button.dataset.action === "increase") updateCartQuantity(key, 1);
  if (button.dataset.action === "decrease") updateCartQuantity(key, -1);
  if (button.dataset.action === "remove") removeFromCart(key);
});

openCart.addEventListener("click", showCart);
closeCart.addEventListener("click", hideCart);
closeModal.addEventListener("click", closeProductModal);
overlay.addEventListener("click", () => {
  closeProductModal();
  hideCart();
});
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;

  if (productModal.classList.contains("open")) closeProductModal();
  if (cartPanel.classList.contains("open")) hideCart();
});
modalAddButton.addEventListener("click", addModalSelectionToCart);
checkoutButton.addEventListener("click", requestOrder);

window.addEventListener("scroll", updateHeaderState, { passive: true });
updateHeaderState();

if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  updateHeroParallax();
  window.addEventListener("scroll", updateHeroParallax, { passive: true });
  window.addEventListener("resize", updateHeroParallax);
}

renderProducts();
cart = loadCart();
renderCart();
initializeRevealAnimations();

function initDeepLink() {
  const match = window.location.hash.match(/^#producto-(\d+)-(.+)$/);
  if (!match) return;

  const productId = Number(match[1]);
  const colorSlug = match[2];
  const product = products.find((p) => p.id === productId);
  if (!product) return;

  const color = product.colors.find((c) => getColorSlug(c.name) === colorSlug);
  if (!color) return;

  const productSection = document.querySelector("#productos");
  if (productSection) productSection.scrollIntoView({ behavior: "instant" });

  openProductModal(productId, color.name);
}

initDeepLink();
