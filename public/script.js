// Replace with your Firebase configuration from Firebase Console
const firebaseConfig = {
    apiKey: "your-api-key",
    authDomain: "your-auth-domain",
    projectId: "your-project-id",
    storageBucket: "your-storage-bucket",
    messagingSenderId: "your-messaging-sender-id",
    appId: "your-app-id"
  };
  
  // Initialize Firebase
  firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  
  let currentUser = null;
  
  // Sign Up
  function signUp() {
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      auth.createUserWithEmailAndPassword(email, password)
          .then((userCredential) => {
              currentUser = userCredential.user;
              updateAuthStatus();
              alert('Account created successfully!');
          })
          .catch((error) => {
              alert('Error: ' + error.message);
          });
  }
  
  // Log In
  function logIn() {
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      auth.signInWithEmailAndPassword(email, password)
          .then((userCredential) => {
              currentUser = userCredential.user;
              updateAuthStatus();
              alert('Logged in successfully!');
          })
          .catch((error) => {
              alert('Error: ' + error.message);
          });
  }
  
  // Log Out
  function logOut() {
      auth.signOut().then(() => {
          currentUser = null;
          updateAuthStatus();
          alert('Logged out successfully!');
      }).catch((error) => {
          alert('Error: ' + error.message);
      });
  }
  
  // Update UI based on authentication status
  function updateAuthStatus() {
      const authStatus = document.getElementById('authStatus');
      const fishFormSection = document.getElementById('fishFormSection');
      if (currentUser) {
          authStatus.textContent = `Logged in as: ${currentUser.email}`;
          fishFormSection.style.display = 'block';
          loadFish(currentUser.uid);
      } else {
          authStatus.textContent = 'Not logged in';
          fishFormSection.style.display = 'none';
          document.getElementById('fishList').innerHTML = '';
      }
  }
  
  // Monitor authentication state
  auth.onAuthStateChanged((user) => {
      currentUser = user;
      updateAuthStatus();
  });
  
  // Submit Fish Form
  document.getElementById('fishForm').addEventListener('submit', async (e) => {
      e.preventDefault();
  
      if (!currentUser) {
          alert('Please log in to add a fish.');
          return;
      }
  
      const formData = new FormData();
      formData.append('species', document.getElementById('species').value);
      formData.append('size', document.getElementById('size').value);
      formData.append('weight', document.getElementById('weight').value);
      formData.append('catchMethod', document.getElementById('catchMethod').value);
      formData.append('location', document.getElementById('location').value);
      formData.append('date', document.getElementById('date').value);
      formData.append('photo', document.getElementById('photo').files[0]);
      formData.append('userId', currentUser.uid);
  
      try {
          const response = await fetch('/fish', {
              method: 'POST',
              body: formData
          });
          const result = await response.json();
          alert(result.message);
          loadFish(currentUser.uid);
          document.getElementById('fishForm').reset();
      } catch (err) {
          alert('Error adding fish: ' + err.message);
      }
  });
  
  // Load Fish for the Current User
  async function loadFish(userId) {
      try {
          const response = await fetch(`/fish?userId=${userId}`);
          const fishList = await response.json();
          const fishListDiv = document.getElementById('fishList');
          fishListDiv.innerHTML = '';
  
          fishList.forEach(fish => {
              const fishCard = document.createElement('div');
              fishCard.className = 'fish-card';
              fishCard.innerHTML = `
                  ${fish.photoPath ? `<img src="${fish.photoPath}" alt="${fish.species}">` : ''}
                  <div class="fish-details">
                      <h3>${fish.species}</h3>
                      <p>Size: ${fish.size}</p>
                      <p>Weight: ${fish.weight}</p>
                      <p>Caught: ${fish.catchMethod}</p>
                      <p>Location: ${fish.location}</p>
                      <p>Date: ${fish.date}</p>
                  </div>
              `;
              fishListDiv.appendChild(fishCard);
          });
      } catch (err) {
          console.error('Error loading fish:', err);
      }
  }