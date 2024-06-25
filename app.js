//jshint esversion:6
require('dotenv').config()
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose=require("mongoose");
// const md5=require("md5");
// const encrypt=require("mongoose-encryption");
// const bcrypt=require("bcrypt");
// const saltRounds=10;
const session=require("express-session");
const passport=require("passport");
const passportLocalMongoose=require("passport-local-mongoose");
const GoogleStrategy = require( 'passport-google-oauth2' ).Strategy;
const findOrCreate=require("mongoose-findorcreate")

const app = express();

app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
  extended: true
}));

app.use(session({
    secret:"Our little secret.",
    resave:false,
    saveUninitialized:false,
    cookie: {
        maxAge: 60 * 1000 // 1 minute in milliseconds
      }
}));

app.use(passport.initialize());
app.use(passport.session());


mongoose.connect("mongodb://127.0.0.1:27017/userDB");



const userSchema= new mongoose.Schema({
    username:String,
    password:String,
    googleId:String,
    secret:String
    
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

// userSchema.plugin(encrypt, { secret:process.env.SECRET, encryptedFields:["password"] });

const User=new mongoose.model("users",userSchema);

passport.use(User.createStrategy());
passport.serializeUser((user, done) => {
    done(null, user.id);
  });
  
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

passport.use(new GoogleStrategy({
    clientID:process.env.CLIENT_ID,
    clientSecret:process.env.CLIENT_SECRET ,
    callbackURL: "http://localhost:3000/auth/google/secrets",
     userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
    passReqToCallback   : true
  },
  function(request, accessToken, refreshToken, profile, done) {
    
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return done(err, user);
    });
  }
));



app.get("/",function(req,res){
    res.render("home")
});

app.get('/auth/google',
    passport.authenticate('google', { scope:
        [ 'profile' ] }
  ));

  app.get('/auth/google/secrets', 
    passport.authenticate('google', { failureRedirect: '/login' }),
    function(req, res) {
      // Successful authentication, redirect home.
      res.redirect('/secrets');
    });

app.get("/login",function(req,res){
    res.render("login")
});

app.get("/register",function(req,res){
    res.render("register")
});

// app.post("/register",async function(req,res){
//     try{
//         bcrypt.hash(req.body.password, saltRounds, async function(err, hash) {
//             const nayaUser= new User({
//                 username:req.body.username,
//                 // password:md5(req.body.password)
//                 password:hash
//             })
//             await nayaUser.save();
//            res.render("secrets")
//         });

    
//     }catch(error){console.log(error)

//     }
// });

// app.post("/login",async function(req,res){
//     const username=req.body.username;
//     // const password=md5(req.body.password);
//     const password=req.body.password;
//     try{
//     const found=await User.findOne({"username":username});
//     if(found){
//         bcrypt.compare(password,found.password, function(err, result) {
//             if(result==true){
//                 res.render("secrets")
//             }
//             else{
//                 res.render("wrong password");
//             }
//         });
        
//     }
//     else{
//             res.render("user not found");
//     }
// }catch(error){
//     console.log(error);
// }
// })
app.get("/secrets", async function(req,res){
    try{
    foundUsers=await User.find({"secret":{$ne:null}});
    if (foundUsers){
        res.render("secrets",{usersWithSecrets:foundUsers})
    }

    }catch(err){
        console.log(err)
    }
    
});

app.get("/submit",function(req,res){
    if (req.isAuthenticated()){
        res.render("submit");
    }else{
        res.redirect("/login")
    }
});

app.post("/submit",async function(req,res){
    const SubmittedSecret=req.body.secret;
    console.log(req.user.id)
    
    try{
        const foundUser=await User.findById(req.user.id);
        if (foundUser){
            foundUser.secret=SubmittedSecret;
            await foundUser.save();
            res.redirect("/secrets")
        }

    }
    catch(err){
        console.log(err);
    }
});

app.get("/logout",function(req,res){
    req.logout(function(err){
        if (err){
            console.log(err);
            
        }
        res.redirect("/");
    });
    
});


app.post("/register",function(req,res){
    User.register({username:req.body.username},req.body.password,function(err,user){
        if (err){
            console.log(err);
            res.redirect("/register");
        }else{
            passport.authenticate("local")(req,res,function(){
                res.redirect("/secrets");
            })
        }
    })
});

app.post("/login",function(req,res){
    const user=new User({
        username:req.body.username,
        password:req.body.password
    });

    req.login(user,function(err){
        if (err) {
            console.log(err);
        }else{
            passport.authenticate("local")(req,res,function(){
                res.redirect("/secrets");
            });
        }
    });
});



app.listen(3000, function() {
  console.log("Server started on port 3000.");
});
