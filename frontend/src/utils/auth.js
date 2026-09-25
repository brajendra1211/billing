export function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("role");
  localStorage.removeItem("user"); // agar store karte ho
  window.location.href = "/login";
}
