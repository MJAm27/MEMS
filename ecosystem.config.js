module.exports = {
    apps: [{
        name: "mems-client",
        cwd: "./client",
        script: "npm",
        args: "start"
    }, {
        name: "mems-server",
        cwd: "./server",
        script: "npm",
        args: "start"
    }]
}