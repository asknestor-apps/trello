var Trello = require('node-trello');
var moment = require('moment');
var trelloErrorHandler = require('./error');

var colorMap = {
  'green': '#61bd4f',
  'yellow': '#f2d600',
  'orange': '#ffab4a',
  'red': '#eb5a46',
  'purple': '#c377e0',
  'blue': '#0079bf',
  'sky': '#00c2e0',
  'lime': '#51e898',
  'pink': '#ff80ce',
  'black': '#4d4d4d',
  'null': '#b6bbbf'
}

var getLists = function(msg, done, callback) {
  trello = new Trello(process.env.NESTOR_TRELLO_KEY, process.env.NESTOR_TRELLO_TOKEN);
  trello.get("/1/boards/" + process.env.NESTOR_TRELLO_BOARD, function(err, data) {
    if (err) {
      trelloErrorHandler(err, msg, done);
    } else {
      board = data;
      trello.get("/1/boards/" + process.env.NESTOR_TRELLO_BOARD + "/lists", function(err, data) {
        if (err) {
          trelloErrorHandler(err, msg, done);
        } else {
          var i, len, lists;
          lists = {}
          for (i = 0, len = data.length; i < len; i++) {
            list = data[i];
            lists[list.name.toLowerCase()] = list;
          }
          callback(board, lists);
        }
      });
    }
  });
};

var createCard = function(msg, list_name, cardName, done) {
  msg.reply("Sure thing boss. I'll create that card for you.").then(function() {
    getLists(msg, done, function(board, lists) {
      trello = new Trello(process.env.NESTOR_TRELLO_KEY, process.env.NESTOR_TRELLO_TOKEN);
      id = lists[list_name.toLowerCase()].id;

      trello.post("/1/cards", {
        name: cardName,
        idList: id
      }, function(err, data) {
        if (err) {
          msg.reply("There was an error creating the card", done);
        } else {
          msg.reply("OK, I created that card for you. You can see it here: " + data.url, done);
        }
      });
    });
  });
};

var showCards = function(msg, list_name, done) {
  var id;

  getLists(msg, done, function(board, lists) {
    var list = lists[list_name.toLowerCase()];
    if (!list) {
      msg.send("Oops, I couldn't find a list named: " + list_name + ". Here are the lists in this board:").then(function() {
        var listPayload = [];

        Object.keys(lists).forEach(function(key) {
          listPayload.push(msg.newRichResponse({title: key, fallback: key}));
        });

        msg.send(listPayload).then(function() {
          var firstList = Object.keys(lists)[0];
          msg.send("To find out what cards you have in the \"" + firstList + "\" list, say `@nestorbot: trello list " + firstList + "`", done);
        });
      });
    } else {
      var id = lists[list_name.toLowerCase()].id;
      trello.get("/1/lists/" + id, {
        cards: "open"
      }, function(err, data) {
        var card, i, len, ref;
        if (err) {
          msg.reply("There was an error showing the list.", done);
        } else {
          if (data.cards.length !== 0) {
            msg.reply("Here are all the cards in " + data.name + ":").then(function() {
              var cards = [];

              for (i in data.cards) {
                var card = data.cards[i];
                var labelColors = card.labels.map(function(l) { return l.color; });
                var labelNames = card.labels.map(function(l) { return l.name; });
                var color = null;
                if(labelColors.length > 0) {
                  color = labelColors[0];
                }

                if(color) {
                  color = colorMap[color] || '#b6bbbf';
                } else {
                  color = '#b6bbbf';
                }

                cards.push(msg.newRichResponse({
                  title: card.name,
                  title_link: card.shortUrl,
                  fallback: "* [" + card.shortLink + "] " + card.name + " - " + card.shortUrl,
                  color: color,
                  fields: [
                  {
                    "title": "ID",
                    "value": card.shortLink,
                    "short": true
                  },
                  {
                    "title": "Labels",
                    "value": labelNames.join(', '),
                    "short": true
                  }]
                }));
              }

              msg.send(cards, done);
            });
          } else {
            msg.reply("No cards are currently in the " + data.name + " list.", done);
          }
        }
      });
    }
  });
};

var moveCard = function(msg, card_id, list_name, done) {
  var id;
  getLists(msg, done, function(board, lists) {
    if(Object.keys(lists).length > 0) {
      id = lists[list_name.toLowerCase()].id;
      if (!id) {
        msg.reply("I couldn't find a list named: \"" + list_name + "\".", done);
      }
      if (id) {
        trello.put("/1/cards/" + card_id + "/idList", {
          value: id
        }, function(err, data) {
          if (err) {
            msg.reply("Sorry boss, I couldn't move that card after all.", done);
          } else {
            msg.reply("Yep, ok, I moved that card to " + list_name + ".", done);
          }
        });
      }
    } else {
      msg.send("Oops, you don't have any lists in this board", done);
    }
  });
};

module.exports = function(robot) {
  robot.respond(/trello new ["'](.+)["']\s(.*)/i, { suggestions: ["trello new \"<card>\" <list>"] }, function(msg, done) {
    var card_name, list_name;
    list_name = msg.match[1];
    card_name = msg.match[2];

    if (card_name.length === 0) {
      msg.reply("You must give the card a name", done);
    }
    if (list_name.length === 0) {
      msg.reply("You must give a list name", done);
    }

    createCard(msg, list_name, card_name, done);
  });

  robot.respond(/trello list lists/i, { suggestions: ["trello list lists"] }, function(msg, done) {
    getLists(msg, done, function(board, lists) {
      listPayload = [];
      if(Object.keys(lists).length > 0) {
        Object.keys(lists).forEach(function(key) {
          listPayload.push(msg.newRichResponse({title: key, fallback: key}));
        });

        msg.send(listPayload).then(function() {
          var firstList = Object.keys(lists)[0];
          msg.send("To find out what cards you have in the \"" + firstList + "\" list, say `@nestorbot: trello list " + firstList + "`", done);
        });
      } else {
        msg.send("Oops, you don't have any lists in this board", done);
      }
    });
  });

  robot.respond(/trello list ["']*([^'"]+)["']*/i, { suggestions: ["trello list <list>"] }, function(msg, done) {
    showCards(msg, msg.match[1], done);
  });

  robot.respond(/trello move (\w+) (?:to )*["']*([^'"]+)["']*/i, { suggestions: ["trello move <card> to <list>"] }, function(msg, done) {
    moveCard(msg, msg.match[1], msg.match[2], done);
  });

};
