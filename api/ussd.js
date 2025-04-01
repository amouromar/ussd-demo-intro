import { createClient } from '@vercel/kv';
import questions from '../questions.js';

// Initialize Vercel KV client (use your KV URL and token from Vercel dashboard)
const kv = createClient({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  const { sessionId, text } = req.query; // Africa's Talking sends sessionId and text
  const sessionKey = `session:${sessionId}`;

  // Fetch or initialize session state
  let session = await kv.get(sessionKey);
  if (!session) {
    session = { currentQuestionIndex: 0, answers: [], hasError: false };
    await kv.set(sessionKey, session);
  }

  const { currentQuestionIndex, answers, hasError } = session;
  const totalQuestions = questions.length;

  // Handle user input
  if (text === '' || text === undefined) {
    // Initial request: Show first question
    const question = questions[0];
    return res.status(200).send(`CON ${question.question}\n${question.options.join('\n')}`);
  }

  // Process user response
  const currentQuestion = questions[currentQuestionIndex];
  const userInput = text.trim();
  const isValidInput = /^\d+$/.test(userInput) && parseInt(userInput) >= 1 && parseInt(userInput) <= currentQuestion.options.length;

  if (!isValidInput && currentQuestionIndex < totalQuestions) {
    // Invalid input: Show error and repeat question
    session.hasError = true;
    await kv.set(sessionKey, session);
    return res.status(200).send(`CON Invalid input. Please try again.\n${currentQuestion.question}\n${currentQuestion.options.join('\n')}`);
  }

  // Valid input: Record answer and proceed
  if (currentQuestionIndex < totalQuestions) {
    session.answers.push(userInput);
    session.currentQuestionIndex += 1;
    session.hasError = false;
    await kv.set(sessionKey, session);

    if (session.currentQuestionIndex < totalQuestions) {
      // Show next question
      const nextQuestion = questions[session.currentQuestionIndex];
      return res.status(200).send(`CON ${nextQuestion.question}\n${nextQuestion.options.join('\n')}`);
    } else {
      // End of game: Calculate and show score
      const correctAnswers = questions.map(q => q.answer);
      const score = session.answers.reduce((acc, answer, idx) => acc + (answer === correctAnswers[idx] ? 1 : 0), 0);
      return res.status(200).send(`END You answered ${score} out of ${totalQuestions} questions correctly.`);
    }
  }
}