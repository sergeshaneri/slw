from telegram.ext import ConversationHandler

# States
IDLE = 0
IN_SCRIPT = 1
WAITING_OPEN_ANSWER = 2
WAITING_EXERCISE_ACK = 3
WAITING_SCORE = 4
