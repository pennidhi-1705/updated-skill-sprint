import { read, write, uid } from "./storage";

export function register(payload) {
  const users = read("users", []);
  if (users.some(u => u.email.toLowerCase() === payload.email.toLowerCase())) {
    throw new Error("An account with this email already exists.");
  }
  const user = { id: uid("user"), createdAt: new Date().toISOString(), ...payload };
  write("users", [...users, user]);
  write("currentUser", user);
  return user;
}

export function login(email, password) {
  const users = read("users", []);
  const user = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
  if (!user) throw new Error("Invalid email or password.");
  write("currentUser", user);
  return user;
}

export function logout() { localStorage.removeItem("skillsprint:currentUser"); }
export function getCurrentUser() { return read("currentUser", null); }
export function isLoggedIn() { return !!getCurrentUser(); }