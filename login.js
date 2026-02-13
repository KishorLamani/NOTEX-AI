const formTitle = document.getElementById("formTitle");
const emailField = document.getElementById("email");
const submitBtn = document.getElementById("submitBtn");
const toggleText = document.getElementById("toggleText");
const toggleLink = document.getElementById("toggleLink");
const authForm = document.getElementById("authForm");

let isLogin = true;

// 1. Function to handle UI changes between Login and Signup
function toggleForm() {
    isLogin = !isLogin;

    if (isLogin) {
        formTitle.innerText = "Login";
        submitBtn.innerText = "Login";
        // Show only Username and Password for login
        emailField.classList.add("hidden"); 
        emailField.removeAttribute("required");
        toggleText.innerHTML = `Don't have an account? <span id="toggleLink">Create one</span>`;
    } else {
        formTitle.innerText = "Create Account";
        submitBtn.innerText = "Register";
        // Show Email field for registration
        emailField.classList.remove("hidden");
        emailField.setAttribute("required", "");
        toggleText.innerHTML = `Already have an account? <span id="toggleLink">Login</span>`;
    }
    // Reattach listener to the new span created by innerHTML
    document.getElementById("toggleLink").addEventListener("click", toggleForm);
}

toggleLink.addEventListener("click", toggleForm);

// 2. Handle Auto-toggle if coming from the Signup button on Home
window.addEventListener("DOMContentLoaded", () => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('mode') === 'signup') {
        toggleForm();
    }
});

// 3. Form Submission Logic (The core validation)
authForm.addEventListener("submit", function(e) {
    e.preventDefault();

    const usernameInput = document.getElementById("username").value;
    const emailInput = document.getElementById("email").value;
    const passwordInput = document.getElementById("password").value;
    
    // Retrieve users from localStorage
    const users = JSON.parse(localStorage.getItem("appUsers") || "[]");

    if (isLogin) {
        // LOGIN MODE: 
        // We look for a user where the username AND password match
        const userFound = users.find(u => u.username === usernameInput && u.password === passwordInput);

        if (userFound) {
            alert("Login successful! Welcome back, " + userFound.username);
            // Save current session
            localStorage.setItem("isLoggedIn", "true");
            localStorage.setItem("currentUser", userFound.username);
            window.location.href = "index.html";
        } else {
            // Error if account is not found or credentials don't match
            alert("Error: Invalid username or password. If you don't have an account, please sign up first.");
        }
    } else {
        // SIGNUP MODE:
        // Check if username or email is already taken
        const alreadyExists = users.some(u => u.username === usernameInput || u.email === emailInput);

        if (alreadyExists) {
            alert("Error: Username or Email is already registered!");
        } else {
            // Save new user object to the array
            users.push({ 
                username: usernameInput, 
                email: emailInput, 
                password: passwordInput 
            });
            localStorage.setItem("appUsers", JSON.stringify(users));
            alert("Account created successfully! You can now login with your credentials.");
            toggleForm(); // Switch back to login view automatically
        }
    }
});