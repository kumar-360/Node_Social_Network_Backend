const fs = require("fs");
const path = require("path");

const { validationResult } = require("express-validator");

const Post = require("../models/post");
const User = require("../models/user");

exports.getPosts = async (req, res, next) => {
    const currentPage = req.query.page || 1;
    const perPage = 2;
    let totalItems;
    try {
        const count = await Post.find().countDocuments();
        totalItems = count;
        const posts = await Post.find().populate('creator')
            .skip((currentPage - 1) * perPage)
            .limit(perPage);
        res.status(200).json({ message: "Fetched posts successfully.", posts: posts, totalItems: totalItems });
    }
    catch (err) {
        if (!err.statusCode) {
            err.statusCode = 500;
        }
        next(err);
    }
};

exports.createPost = async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const error = new Error("Validation failed, data entered is incorrect.");
        error.statusCode = 422;
        throw error;
    }
    if (!req.file) {
        const error = new Error("No image provided.");
        error.statusCode = 422;
        throw error;
    }
    try {
        const user = await User.findById(req.userId);
        const imageUrl = req.file.path;
        const title = req.body.title;
        const content = req.body.content;
        const post = new Post({
            title: title,
            content: content,
            imageUrl: imageUrl,
            creator: req.userId
        });
        await post.save();
        const creator = User.findById(req.userId);
        user.posts.push(post);
        await user.save();
        res.status(201).json({
            message: "Post created successfully!",
            post: post,
            creator: { _id: creator._id, name: creator.name }
        });
    }
    catch (err) {
        if (!err.statusCode) {
            err.statusCode = 500;
        }
        next(err);
    }
};

exports.getPost = async (req, res, next) => {
    const postId = req.params.postId;
    try {
        const post = await Post.findById(postId)
        if (!post) {
            const error = new Error("Post could not be found.");
            error.statusCode = 404;
            throw err;
        }
        res.status(200).json({ message: "Post fetched", post: post });
    }
    catch (err) {
        if (!err.statusCode) {
            err.statusCode = 500;
        }
        next(err);
    }
};

exports.updatePost = async (req, res, next) => {
    const postId = req.params.postId;
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const error = new Error("Validation failed, data entered is incorrect.");
        error.statusCode = 422;
        throw error;
    }
    const title = req.body.title;
    const content = req.body.content;
    let imageUrl = req.body.image;
    if (req.file) {
        imageUrl = req.file.path;
    }
    if (!imageUrl) {
        const error = new Error("No file picked");
        error.statusCode = 422;
        throw error;
    }
    try {
        const post = await Post.findById(postId)
        if (!post) {
            const error = new Error("Post could not be found.");
            error.statusCode = 404;
            throw err;
        }
        if (post.creator.toString() !== req.userId.toString()) {
            const error = new Error("Not authorized.");
            error.statusCode = 403;
            throw err;
        }
        if (imageUrl !== post.imageUrl) {
            clearImage(post.imageUrl);
        }
        post.title = title;
        post.content = content;
        post.imageUrl = imageUrl;
        const result = await post.save();
        res.status(200).json({
            message: "Post updated",
            post: result
        });
    }
    catch (err) {
        if (!err.statusCode) {
            err.statusCode = 500;
        }
        next(err);
    }
}

const clearImage = filePath => {
    filePath = path.join(__dirname, "../", filePath);
    fs.unlink(filePath, err => console.log(err));
}

exports.deletePost = async (req, res, next) => {
    const postId = req.params.postId;
    try {
        const post = await Post.findById(postId)
        if (!post) {
            const error = new Error("Post could not be found.");
            error.statusCode = 404;
            throw error;
        }
        if (post.creator.toString() !== req.userId.toString()) {
            const error = new Error("Not authorized.");
            error.statusCode = 403;
            throw error;
        }
        clearImage(post.imageUrl);
        await Post.findByIdAndDelete(postId);

        const user = await User.findById(req.userId);
        user.posts.pull(postId);
        await user.save();
        res.status(200).json({ message: "Post deleted." });
    }
    catch (err) {
        if (!err.statusCode) {
            err.statusCode = 500;
        }
        next(err);
    }
}