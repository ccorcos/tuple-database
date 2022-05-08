
# Part 1

Hello,
My name is Chet Corcos,
and in this video
I'd like to tell you about this database I built.

---

To give you an overview,

First, I'm going to talk about my background and motivation for building this database.

Then I'm going to walk through the code
and show you exactly how I built this database
and how it works.

Next, I'm going to walk you through some examples
that demonstrate how you actually use this thing.

And finally, I'm going to talk about my goals for this project
and future work to be done.


---

For some context about me,
I was the first engineering hire at Notion,
and while building Notion, I learned a lot about databases,
and learned a lot about what I want from a database.



Two of my interests that were driving my work at Notion:
were end-user computing
and personal creative software.

End-user computing has to do with
giving end-users the ability
to model information in their world,
write queries and interact with that data.

Personal creative software is all about helping individuals create and build things.
All the things a person might do without software:
Manage a calendar, contact list, mail,
Or collaborate on some creative artifact like an engineering drawing.


From a technical standpoint, its' important to recognize
that personal software doesn't require the inherent centralization
or large multi-tenant database that is necessary for YouTube or a bank.



I have since moved on from Notion, and I've picked up a few more interests.


Local-first software is software that
doesn't necessarily keep your data in the cloud.

There are all kinds of motivations for local-first software
like freedom and privacy,
but for me, the most acute reason is that
it frees developers from endless maintenance of a gigantic multi-tenant system.
When users own all of their data on their devices,
it's a natural way of sharding a database and scaling up a platform.


I've also become interested in peer-to-peer networking.
Peer-to-peer working just means
that devices should be able to speak to each other directly.

Along the same lines as before,
this means leveraging existing internet infrastructure
without having to build an maintain your own.

But I'm also interested in how it enables people to be more self-reliant,
enabling tools to continue operating even after
the companies that built them get shut down.



I bring up these interests,
because the database I built
is designed from this perspective.

My goal is not to build an infinitely scalable
multi-tenant, SaaS database.

My goal is to build a database to power local-first personal software.



---

# Part 2



Now let's talk about the requirements for this database.


In the early days of SQL,
the purpose was mostly for business intelligence.

Most of the data ingested was tabular, often financial data.

And being used for business intelligence,
the queries demanded of the database
were widely varying and changing.

Things like:
what is the most popular hour of the day that people buy milk?
Or:
what was the most popular beverage sold in the week leading up to the super bowl?


These queries do not need update in "realtime".
The query optimizer is the most valuable part about SQL,
leveraging indexes to answer a wide variety of questions
as efficiently as possible.




Now-a-days, applications have a much different set of demands.

Many-to-many relationships are very common.
Many users can belong to many group chats.
Many pages and have many tags.

Even a basic social media app
that shows a list of posts from all the people you follow
is very nontrivial to build and scale using SQL.



Applications are also tend to be fairly rigid and consistent
in the kinds of queries they ask the database.
In this case, the SQL query optimizer is often undesirable
because it leads to non-deterministic performance.

At Notion, I often found myself fine-tuning and index
to exactly match the a query.
Postgres calls this an "index-only scan" and its very performant
But I'm also doing all of the same work twice,
once to construct the index,
next to construct a query that will exactly scan that index.

What I wanted was direct access to the indexes
without having to write SQL.



Applications also have lots of relational queries
and in SQL, that involves a JOIN, which cannot be indexed.


Lastly, all queries must be reactive.
Polished applications require realtime reactivity.
It's not just for collaboration,
it's necessary when a user has multiple windows or tabs
showing the same data.




The next set of requirements deal specifically with "end user databases".

I use the term "end user database" to
refer to applications like Notion and Airtable
that allow end-users to create properties, write queries, and maniplate data.

With SQL, you cannot index user-defined properties.
You would never want to let millions of users
run ALTER TABLE on a large multi-tenant database.

At Notion, any indexing, caching, and querying we had to build ourselves.

It turns out, the problem has to do with schemas.
For an end-user database, schemas are an application-level concept
not a database-level concept.

Another way of saying it:
We cannot know at compile-time what the user's database schema and queries are.



As for a local-first database,
in the world of offline peer-to-peer sync
pure conflicts are always a possibility.
There is no general solution for "automatically" resolving conflicts.

Similar to schemas,
resolving conflicts needs to be the responsibility
of the application, not the database.



This database is not intended to run a large multi-tenant SaaS.
It's intended to hold data only for a single user,
thus we don't have to worry about hyper-scaling and sharding.

It also does not need to run its own server.
It is what's called an "embedded database"
Just like to SQLite, it runs in the application process.



One bonus requirement that deserves its own talk
is the ability to use this database
for frontend state management.

If we are able to meet all of the above requirements,
then all we need to do is be able to run it in the browser.

And due to the fact that the browser requires certain behaviors
like opening a popup window
to be called synchronously in the same event loop as a user action,
we want to be able to operate this database synchronously.




---

# Part 3

Before we jump into the weeds,
we first need to talk about what a database is
and how they generally work.

A database stores data in a way for efficient retrieval.


Almost every database uses an Ordered Key-Value database under the hood.
Ordered keys means we can leverage binary search to look up data.
Thus the performance of our database can scale with log(n)
where n is the amount of data in the database.


But ordered byte strings are not a very convenient to work with.
Instead, databases represent ordered tuples that are then encoded into bytes
and stored in an ordered key-value storage.

My database is called a "tuple database"
because it stores ordered tuples directly without having to encode
tuples into byte strings...
More on that later...


But just to give you a glimpse of where we're going
A simple SQL schema of a player with a name and a score
and an index on player score
will be represented by the following tuple-value pairs
in the underlying ordered key-value storage.

When you want to look up a player by id,
you just need to binary search this ordered list of tuples.
Same with finding the top 10 players by score.


This underlying tuple representation
is exactly why AWS is able to build
Postgres, Mongo, and Elasticsearch-comptible databases
on top of DynamoDb.




Anyways, lets jump into some code
and I'll show you how everything from the ground up.
I've written a bunch tests here to help explain how things work.


//


First, lets talk about sorted tuples.


Something that many people don't realize
is that tuples are component-wise sorted.
That is, the first element is compared to the first element
then if those are equal,
we'll move on and compare the second element to the second element.


For some reason, people totally understand this
when using first and last names as an example,
but they don't always recognize and understand this more generally.

In this example, you'll notice that when you join the elements together,
jonathan smith comes before job smith which is wrong!




Now, I told you that my database is a tuple database,
not an ordered key-value store
and so it does not require tuples to be encoded into byte strings.

However, if you want to use an ordered key-value store
as a storage layer for this database,
then you will need to encode these tuples afterall.

//

The simplest way to encode tuples
is to join them together will a null byte.
This way, \x00 is less than the "a" in jonathan.

I'll leave it as an exercise for you to think about how
escape null bytes in the strings while preserving the correct ordering.


//

We've just been talking about string so far,
but there are other types of data we might care about too.

Numbers, in particular, will not have the correct order
if you simply stringify them.

Instead, we're using a library called elen
to encode 64 bit floating point numbers
in a lexicographically sortable byte string.

> cmd+click, encodeTuple
> scroll to the top.

There also needs to be an consistent order of value types as well.

This encoding scheme allows you to encode arbitrary JSON values
with a consistent order.

The MIN and MAX symbols are useful values that I will get to later.

> close tab

Anyways so the result is this weird encoded data
that we can save in, for example, DynamoDb or LevelDb
that preserves the order of the original tuples.




//



The next piece of the puzzle is binary search.

I'm assuming you're already familiar with binary search,
but I wanted to demonstrate
how this version will return insertion index
when a position is not found.




//


Now leveraging binary search,
we can write a `scan` function
that uses greater than / less than bounds
to efficiently retrieve data from an ordered list.


Notice that that we can fetch all people
who's first name starts with j with the following bounds.
The upper bound uses k.
Note that we "incremented" j by one byte.

This is inconvenient and makes it hard to write prefix queries.
How do I get all people names "jon"?

this is where the MIN and MAX symbols are useful.



//



Now, all the code so far
has dealt just with tuples,
but as you know, this is a tuple-value database.

But binarySearch is written in a generic way
that accepts a custom compare function.

So we can create a key-value object
and keep them sorted by key.


//


Now we have all the primitives in place
to start building our database storage layer.

The in memory storage layer
uses all the functions we just talked about.

> cmd+click

It stores all the data in an ordered array
as key-value objects.

And as you can see, it works just like before.



//



And we can create other storage backends as well
just by implementing the storage api.

> cmd+click levelstorage
> cmd+click async tuple storage api

The storage api is really simple
Just commit for writes
and scan for reads.

And as you can see,
we need to do some encoding and decoding
for everything to work.


Notice that this is an asychronous storage layer
whereas the In memory storage is synchronous



//

The SQlite storage layer is fairly similar.

> cmd+click

There's just a single table primary key column
and a value column

and scan constructs a query with the proper bounds.

//
> Back to HTML Editor, next bullet.


Next I'm going to walk you through
the core database mechanics.


The TupleDatabase is a level of abstraction
on top of the storage layer.

It brokers all reads and writes to the storage layer
to implement reactivity
and concurrency constrol.



Subscribing works just like scanning.
And when you write to the database,
the event emitter fires.


> cmd+click tuple database

All the reactivity is managed by the ReactivityTracker

> cmd+click reactivity tracker.

The reactivity tracker keeps track of listeners
using the in-memoery storage abstraction.

> cmd+click subscribe

Basically, find a prefix for the given bounds of a query
and we store that prefix along with the callback
and the original bounds.

> back to the test...

//

And so when we call subscribe, with these bounds
we can see that the prefix is ["score"]

And then when we write,
we call computeReactivityEmits

> cmd+click 6 times -> getListenerCallbacksForTuple -> iterateTuplePrefixes

For each tuple we write,
we compute all of the prefixes

> where is it used
then we look for listeners at that prefix.

> where is it used
we double check that the tuple is within bounds.

> close
and it returns a map of each listener callback
and the associated writes.

> cmd+click tuple database
show where this.reactivity is used.



//


Concurrency control is the other thing
that the TupleDatabase manages.

There's a higher-level api that we end up using in practice
but we can still demonstrate how it works here.

Basically, every transaction generates an id.
Chet and Meghan represent two people
concurrently reading and writing to the database.

Meghan scans all the scores to compute a total
Meanwhile, Chet writes a new score.

this means that when meghan writes the total,
it will be "wrong"
in the sense that the scores have changes
between the time the scores were read
and the total was written.

As you can see, the database will throw an error.


//

This is all manages by the ConcurrencyLog.

All the concurrency log does is record reads and writes
and checks whether there are conflicts.

Recreating the previous example,
tx1 reads the scores
and tx2 writes to the score.

inspecting the log shows that we have a read
and then we have a write
with a tuple inside the bounds
of a previous read.

When we commit tx2, we see that there's no conflicts.
But commiting tx1 does have conflicts.

In practice, as you will see,
we just want to wrap these transactions
in a retry.

It's worth mentioning as well
that this implementation of concurrency control
was inspired by the way FoundationDb handles concurrency.
And in case you didnt know,
FoundationDb is the database that powers iCloud.

> back to the HTML Editor.
> next bullet point

So now we've talked about the core database mechanics.
We have all the ingredients for this database,
but it's a bit of a pain to work with.

The DatabaseClient is the next level of abstraction to help with that.

The DatabaseClient handle schemas,
subspaces (another idea inspired by foundationdb),
querying across processes (such as multiple electron windows),
and transactional composition.


//


First, lets take a look at schemas.

The schema of a database
is just the types of key-value objects
that are stored in the database.

And when we construct the database client,
we can see that it takes a tuple database,
which takes a storage layer as well.

Notice that we also have a convenient "prefix" argument to scan
And the return type is correctly inferred.


//


Another helpful abstraction is subspaces.

A suspace simply nests tuples with a prefix.

So for example, maybe we have created an entire app
around this game schema.

We have helper functions like `computeTotalScore`.


But we decide that we want to implement multiple games.
Subspaces help us do this
without having to rewrite all of our helper functions
like `computeTotalScore`

We can simply prefix that schema inside a subspace for each game.

When you hover, you can see that we just appended a prefix
to each key.

Now we can create a db client that is within that subspace.

And reuse all of the helper functions we used before.


//

The next part is unfortunately a bit contrived...

But basically, if you have an application
that has multiple windows,
like an electron app,
then you will need some way of querying the database
from different processes.

There's a bit of wiring missing here,
but the point is just to demonstrate
that there is an async client
and its argument is just an interface
that can be implemented over a socket.

Note that the `subscribe` function has a callback argument
which you will need to handle.

Perhaps one day, I'll give a talk about this little bit here.

//

Last but not least,
the database client has some convenient ways of working with transactions.


First, you can create a transaction
mutate it,
and commit it.


You can also read through the transaction
which will return results as if the transaction has been commited.


Lastly is the `transactionalQuery` helper function.

transactionalQuery accepts a database client or a transaction as the first argument.
If you give it a database client,
it will create a transaction
and retry if there is a conflict.

But if you pass the transaction, it will simply pass the transaction through.
This way, we are able to compose transactional queries together.

So for example, maybe we have a function to update the total scores.

And we have another function to set a person's score.

When we set a person's store, we can also transactinoally update the total.
Note that `updateTotal` is reading the score from the transaction
and so it will pick up the latest user's score.

Then when we set the score, everyhting works!

Better yet, if we set a bunhc of scores concurrently,
hey will all retry until they succeed.

> back to the HTML Editor.

So that's how the whole database works under the hood.


Now I want to show you a few examples of how this thing works in practice.


//

This first example demonstrates how you might model a typical social app.

We have users and posts.
Users can follow other users.
Users have a profile with a time-ordered list of their posts.
And users have a feed of time-ordered posts from everyone they follow.


Now, when we add a follow,
we need to write to both the follows and following indexes.
And then we need to get all the posts from the following's profile
and add it to the followers feed.

Then when we create a post,
we need to add it to that users profile,
and we need to fetch all of the followers
and add the post to their feed.

Something to consider is
if you were to build a cloud social app using FoundationDb
this is exactly how you would do it.
And the main concerns you'd be thinking about
is when transactions will conflict.

So for example, if you add a follow
but meanwhile the person writes a post
then we'll miss a post when adding it to the feed
and we'll have to retry.
This is probably fine and a single retry will work.

When creating a post, we'll get a conflict
if someone is creating a follow for that user at the same time
which means this post will not get added to their feed.
This will create a conflict and retry.
Now, even with Justin Bieber, you'll probably have no problem
here after a few retries at most.


I want to walk you through this thinking
because these abstractions are directly transferable to FoundationDb.
And I think that FoundationDb is vastly underutilized outside of Apple.


Anyways, lets try it out.

We create some users and some posts.
Then when meghan follows chet,
we can see that a post showed up in her feed.

When chet makes another post,
it also shows up in meghan's feed.

Now, there's obviously other logic here
like removing a follow or deleting a post.
And there's more testing we can write as well
But I hope I've demonstrated how this abstraction
allows you granularly manage indexes yourself.

As a result, many-to-many relationships are simple to query and index.
And we get reactivity for all of these complex queries for free
because we're simply reading directly off of the index.


//

The next example demonstrates how you might implement an end-user database.

First, lets flatten out objects into a list of triples, called facts.

This is an example of what that might look like.
Notice how the "set" of tags is flattened out.

Next, lets consider a filter to be like a mongo-style object
that looks for objects with a combination of property-values.

So we're going to have 4 indexes to keep track of.

The "eav" index is stands for entity-attribute-value which is
the lingo many people use when talking about
representing objects as triples like this.

entity is the id.

And so we have the eav index which you can use for fetching an object.

Then we have the ave index for looking up object ids
based on attribute-value.

Then we have a list of user-defined filters.
And for each filter, we have an index of which objects pass those filters.


So lets implement writeFact.
We need to add it to the eav and ave indexes obviously.

But then we need to check if it passes any of the filters.
For each filter,
if the property isn't in the filter, the it won't change the result of the filter.

if the attribute-value doesn't pass the filter, we can remove the object.
Otherwise, we need to check that the object passes the rest of the filter
and if it does, then we can add it to the filter's index of results.


Then writeObject is a convneinence that flattens out the object into facts
and calls writeFact.

And createFilter will add the filter to the filter index,
And then it will start with the first key-value entry
and lookup all objects with that attribute-value pair.

For each object it finds,
it will check that the object passes the rest of the filter.
And then add all those objects to the filter's index.


So lets try it out!

We create some objects.
People with name, age, and tags.

We create a simple filter
that only searches for objects with tag: engineer.

When we scan the index for that filter, we see the results we expect!

Now lets try a compound filter that has two property-value pairs.
Looking for musicians age 31.

And just to check that the filter updates when we create new objects,
we'll create another musician aged 31.

And when we scan that filter's index, we get the results we'd expect!


So there you have it!
I hope that was not too contrived.
But what I just demonstrated
is user-defined properties and indexable user-defined filters!


Consider for a moment,
that this is very similar to how a SQL database works under the hood.

When you, the developer, edit a Postgres schema,
Postgres is keeping track of the different indexes
and dynamically updating those indexes.

Essentially what we've done here
is removes a gigantic layer of abstraction
and dropped down into the lower-level database primitives
that every typical database.

And along the way, we've gained some advantages.
- we can write our queries in TypeScript rather than some other DSL
- we can index just about anything, not limited to the SQL semantics
- all of our queries are super fast and read straight off of an index
- all of our queries are reactive and can easily be paginated



//


Now time for the last example,
and I promise this one is much simpler.

I've built this little app for keeping score in board games.

> website: https://ccorcos.github.io/game-counter/

You can create players
increment and decrement score
and there's a nice little history down here to keep track.

> vscode: game-counter

> GameState.ts

Now, the entire application state is manages by this database.

We have a list of players,
players have a name and a score,
and there's a history index that shows all the actions over time.
Notice how these actions get squashed together
if they happen to the same player within 5 seconds.

We have all the expected actions like
- addPlayer
- deletePlayer
- editName

And this trackHistory bit is a little more complicated.
We get the last history item,
and if the last item is the same player
and its been less than 5 seconds since,
then we'll squashn them together.

Now, when we call incrementScore,
we update the player's score,
and then we call trackHistory.

At the bottom, we have some helper functions
for reading the database


> App.tsx

And then in the app, we simply call these exported functions.

`useTupleDatabase` is a React hook that subscribes to any data fetched by those helper functions.

And the add player button calls the addPlayer query.


We could walk through the rest,
but I think you get the idea at this point.


The real benefit here
is that we get all the benefits of normalization from a database
as well as all the benefits of denomalization and indexing for performance.

And similar to redux,
we're able to define the entire state model in one place
entirely independent of anything else.


> Back to the HTML Editor.
> Part 5

In conclusion...
We've demonstrated a database that gives you fine-grained constrol over indexing,
similar to foundationdb.
But it also has reactivity as well.
And its embedded so it can work with local-first applications.

We have schemas, but those schemas are enforces at runtime
so we can have user-defined attributes
and indexable user-defined queries.


My goal for this project
is to enable people to build more local-first software and end-user databases.

I think that most developers build SaaS tools
simply because it's the easiest thing to build.



What's next for me,
is I plan on building and prototyping a database system
that can be used as a declarative interface for other software.

For example, maybe I can create a tweet object in this database
and when I set the property `send: true` then something else
that has a listener will actually publish the tweet
and set `sent: true`.

This allows me to build a user interface that only ever has to
interact with the database, and allows for functionality to be
much more reusable.


I also plan on experimenting with peer-to-peer networking.
I've dabbled here before, but its a daunting space.
LibP2P seems to have made great progress,
but I worry that it doesn't quite fit the model I have in mind,
where user's have public-key identities and contact lists,
and can reject connections from unknown devices.



Anyways, that's all for now.
If you have experience and are interested in working on that of these topics,
please reach out to me. I'm always looking for collaborators.

My email is ccorcos@gmail.com


Congratulations if you made it this far!
	And thanks for watching.







