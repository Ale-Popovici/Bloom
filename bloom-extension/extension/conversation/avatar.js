// BLOOM - Avatar Implementation

export class Avatar {
  constructor(container) {
    this.container = container;
    this.avatarElement = null;
    this.currentExpression = "neutral";
    this.isSpeaking = false;
    this.initialized = false;

    // Map of viseme IDs to mouth positions
    this.visemeMap = {
      0: "rest", // silence
      1: "ae", // as in "bat"
      2: "aa", // as in "father"
      3: "ah", // as in "cut"
      4: "ao", // as in "dog"
      5: "ey", // as in "say"
      6: "eh", // as in "pet"
      7: "er", // as in "fur"
      8: "ih", // as in "fill"
      9: "iy", // as in "feel"
      10: "uh", // as in "book"
      11: "uw", // as in "boot"
      12: "aw", // as in "cow"
      13: "ay", // as in "hide"
      14: "h", // as in "help"
      15: "r", // as in "red"
      16: "l", // as in "love"
      17: "y", // as in "yes"
      18: "w", // as in "west"
      19: "m", // as in "mom"
      20: "n", // as in "nun"
      21: "ng", // as in "thing"
      22: "f", // as in "fan"
      23: "v", // as in "van"
      24: "th", // as in "thin"
      25: "dh", // as in "then"
      26: "s", // as in "sit"
      27: "z", // as in "zap"
      28: "sh", // as in "she"
      29: "zh", // as in "pleasure"
      30: "p", // as in "pop"
      31: "b", // as in "bob"
      32: "t", // as in "talk"
      33: "d", // as in "dad"
      34: "k", // as in "kick"
      35: "g", // as in "go"
      36: "ch", // as in "church"
      37: "j", // as in "judge"
    };

    // Map of mouth shapes to CSS classes
    this.mouthShapes = {
      rest: "mouth-rest",
      ae: "mouth-open-wide",
      aa: "mouth-open-wide",
      ah: "mouth-open-mid",
      ao: "mouth-open-rounded",
      ey: "mouth-open-mid",
      eh: "mouth-open-mid",
      er: "mouth-rounded",
      ih: "mouth-open-slight",
      iy: "mouth-smile-slight",
      uh: "mouth-rounded-slight",
      uw: "mouth-rounded",
      aw: "mouth-open-rounded",
      ay: "mouth-open-wide-to-rounded",
      h: "mouth-open-slight",
      r: "mouth-rounded-slight",
      l: "mouth-open-slight",
      y: "mouth-smile-slight",
      w: "mouth-rounded",
      m: "mouth-closed",
      n: "mouth-closed",
      ng: "mouth-closed",
      f: "mouth-bite-lip",
      v: "mouth-bite-lip",
      th: "mouth-tongue-teeth",
      dh: "mouth-tongue-teeth",
      s: "mouth-teeth-visible",
      z: "mouth-teeth-visible",
      sh: "mouth-rounded-small",
      zh: "mouth-rounded-small",
      p: "mouth-closed",
      b: "mouth-closed",
      t: "mouth-teeth-visible",
      d: "mouth-teeth-visible",
      k: "mouth-open-slight",
      g: "mouth-open-slight",
      ch: "mouth-rounded-small",
      j: "mouth-rounded-small",
    };
  }

  /**
   * Initialize the avatar
   */
  initialize() {
    // Clear container first
    this.container.innerHTML = "";

    // Create avatar DOM structure
    this.avatarElement = document.createElement("div");
    this.avatarElement.className = "bloom-avatar avatar-neutral";

    // Create face parts
    this.avatarElement.innerHTML = `
        <div class="avatar-head">
          <div class="avatar-face">
            <div class="avatar-eyebrows">
              <div class="eyebrow left"></div>
              <div class="eyebrow right"></div>
            </div>
            <div class="avatar-eyes">
              <div class="eye left"></div>
              <div class="eye right"></div>
            </div>
            <div class="avatar-nose"></div>
            <div class="avatar-mouth">
              <div class="mouth-inner"></div>
            </div>
          </div>
        </div>
      `;

    // Add avatar to container
    this.container.appendChild(this.avatarElement);

    // Add CSS styles if not already added
    if (!document.getElementById("bloom-avatar-styles")) {
      const styleElement = document.createElement("style");
      styleElement.id = "bloom-avatar-styles";
      styleElement.textContent = this.getAvatarStyles();
      document.head.appendChild(styleElement);
    }

    this.initialized = true;
    return true;
  }

  /**
   * Set the avatar's expression
   * @param {string} expression - Expression name ('neutral', 'happy', 'thinking', etc.)
   */
  setExpression(expression) {
    if (!this.initialized || this.currentExpression === expression) {
      return;
    }

    // Remove current expression class
    this.avatarElement.classList.remove(`avatar-${this.currentExpression}`);

    // Add new expression class
    this.avatarElement.classList.add(`avatar-${expression}`);

    this.currentExpression = expression;
  }

  /**
   * Handle viseme events for lip sync
   * @param {number} visemeId - Viseme ID from Azure Speech SDK
   */
  handleViseme(visemeId) {
    if (!this.initialized) return;

    // Get mouth shape from viseme ID
    const viseme = this.visemeMap[visemeId] || "rest";
    const mouthClass = this.mouthShapes[viseme] || "mouth-rest";

    // Apply mouth shape
    const mouth = this.avatarElement.querySelector(".avatar-mouth");

    // Remove all mouth shape classes
    Object.values(this.mouthShapes).forEach((cls) => {
      mouth.classList.remove(cls);
    });

    // Add new mouth shape class
    mouth.classList.add(mouthClass);
  }

  /**
   * Set speaking state
   * @param {boolean} isSpeaking - Whether the avatar is speaking
   */
  setSpeaking(isSpeaking) {
    if (!this.initialized) return;

    this.isSpeaking = isSpeaking;

    if (isSpeaking) {
      this.avatarElement.classList.add("avatar-speaking");
      // Set happy expression while speaking
      this.setExpression("happy");
    } else {
      this.avatarElement.classList.remove("avatar-speaking");
      // Reset to neutral when done speaking
      this.setExpression("neutral");
    }
  }

  /**
   * Get CSS styles for the avatar
   * @returns {string} - CSS styles
   */
  getAvatarStyles() {
    return `
        .bloom-avatar {
          width: 280px;
          height: 280px;
          position: relative;
          margin: 0 auto;
          transition: all 0.3s ease;
        }
  
        .avatar-head {
          width: 200px;
          height: 240px;
          background-color: #f5d7b2;
          border-radius: 50% 50% 45% 45%;
          position: absolute;
          top: 40px;
          left: 50%;
          transform: translateX(-50%);
          box-shadow: 0 10px 20px rgba(0,0,0,0.1);
          overflow: hidden;
        }
  
        .avatar-face {
          position: relative;
          width: 100%;
          height: 100%;
        }
  
        .avatar-eyebrows {
          position: absolute;
          top: 80px;
          width: 100%;
          display: flex;
          justify-content: space-around;
          padding: 0 20px;
          box-sizing: border-box;
          transition: all 0.3s ease;
        }
  
        .eyebrow {
          width: 40px;
          height: 8px;
          background-color: #5D4037;
          border-radius: 4px;
          transition: all 0.3s ease;
        }
  
        .avatar-eyes {
          position: absolute;
          top: 100px;
          width: 100%;
          display: flex;
          justify-content: space-around;
          padding: 0 30px;
          box-sizing: border-box;
        }
  
        .eye {
          width: 30px;
          height: 30px;
          background-color: white;
          border-radius: 50%;
          position: relative;
          overflow: hidden;
        }
  
        .eye::after {
          content: '';
          position: absolute;
          width: 16px;
          height: 16px;
          background-color: #2196F3;
          border-radius: 50%;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
        }
  
        .eye::before {
          content: '';
          position: absolute;
          width: 8px;
          height: 8px;
          background-color: #000;
          border-radius: 50%;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          z-index: 1;
        }
  
        .avatar-nose {
          position: absolute;
          top: 130px;
          left: 50%;
          transform: translateX(-50%);
          width: 20px;
          height: 40px;
          background-color: #e6c6a2;
          border-radius: 30% 30% 45% 45%;
        }
  
        .avatar-mouth {
          position: absolute;
          bottom: 50px;
          left: 50%;
          transform: translateX(-50%);
          width: 80px;
          height: 30px;
          background-color: #e57373;
          border-radius: 20px 20px 40px 40px;
          overflow: hidden;
          transition: all 0.1s ease;
        }
  
        .mouth-inner {
          width: 100%;
          height: 15px;
          background-color: #b71c1c;
          border-radius: 0 0 20px 20px;
          position: absolute;
          bottom: 0;
        }
  
        /* Mouth shapes for visemes */
        .mouth-rest {
          height: 15px;
          border-radius: 30px 30px 10px 10px;
        }
  
        .mouth-open-wide {
          height: 40px;
          border-radius: 20px;
        }
  
        .mouth-open-mid {
          height: 25px;
          border-radius: 20px;
        }
  
        .mouth-open-slight {
          height: 20px;
          border-radius: 30px 30px 20px 20px;
        }
  
        .mouth-rounded {
          height: 30px;
          width: 50px;
          border-radius: 25px;
        }
  
        .mouth-rounded-small {
          height: 25px;
          width: 40px;
          border-radius: 20px;
        }
  
        .mouth-rounded-slight {
          height: 20px;
          width: 60px;
          border-radius: 30px;
        }
  
        .mouth-closed {
          height: 10px;
          border-radius: 5px;
        }
  
        .mouth-smile-slight {
          height: 15px;
          border-radius: 30px 30px 10px 10px;
          transform: translateX(-50%) scaleX(1.2);
        }
  
        .mouth-open-rounded {
          height: 35px;
          width: 60px;
          border-radius: 30px;
        }
  
        .mouth-bite-lip {
          height: 18px;
          border-radius: 20px 20px 5px 5px;
        }
  
        .mouth-teeth-visible::before {
          content: '';
          position: absolute;
          top: 5px;
          left: 10px;
          right: 10px;
          height: 6px;
          background-color: white;
          border-radius: 3px;
        }
  
        .mouth-tongue-teeth::before {
          content: '';
          position: absolute;
          top: 5px;
          left: 15px;
          right: 15px;
          height: 6px;
          background-color: white;
          border-radius: 3px;
        }
  
        .mouth-tongue-teeth::after {
          content: '';
          position: absolute;
          top: 12px;
          left: 25px;
          right: 25px;
          height: 10px;
          background-color: #ff9e80;
          border-radius: 5px;
        }
  
        /* Expression classes */
        .avatar-neutral .avatar-eyebrows {
          top: 80px;
        }
  
        .avatar-neutral .eyebrow {
          transform: rotate(0deg);
        }
  
        .avatar-neutral .avatar-mouth {
          height: 15px;
        }
  
        .avatar-happy .avatar-eyebrows {
          top: 75px;
        }
  
        .avatar-happy .eyebrow.left {
          transform: rotate(-10deg);
        }
  
        .avatar-happy .eyebrow.right {
          transform: rotate(10deg);
        }
  
        .avatar-happy .avatar-mouth {
          height: 25px;
          border-radius: 10px 10px 50px 50px;
          transform: translateX(-50%) scaleX(1.2);
        }
  
        .avatar-thinking .avatar-eyebrows {
          top: 70px;
        }
  
        .avatar-thinking .eyebrow.left {
          transform: rotate(15deg);
        }
  
        .avatar-thinking .eyebrow.right {
          transform: rotate(-15deg);
        }
  
        .avatar-thinking .avatar-mouth {
          width: 40px;
          height: 15px;
          transform: translateX(-70%);
        }
  
        .avatar-confused .avatar-eyebrows {
          top: 75px;
        }
  
        .avatar-confused .eyebrow.left {
          transform: rotate(20deg);
        }
  
        .avatar-confused .avatar-mouth {
          width: 40px;
          height: 20px;
          transform: translateX(-30%);
        }
  
        /* Speaking animation */
        .avatar-speaking .avatar-mouth {
          animation: speak 0.2s infinite alternate;
        }
  
        @keyframes speak {
          0% { height: 15px; }
          100% { height: 30px; }
        }
  
        /* Blinking animation */
        .bloom-avatar .eye {
          animation: blink 4s infinite;
        }
  
        @keyframes blink {
          0% { height: 30px; }
          96% { height: 30px; }
          98% { height: 2px; }
          100% { height: 30px; }
        }
      `;
  }
}
