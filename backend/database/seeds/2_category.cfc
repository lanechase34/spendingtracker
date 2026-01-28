component extends="base" {

    function run(qb, mockdata) {
        var colorService = getColorService();

        qb.table('category')
            .insert([
                {'name': 'Entertainment', 'color': colorService.generateColor()}, // 1
                {'name': 'House', 'color': colorService.generateColor()},
                {'name': 'Car', 'color': colorService.generateColor()},
                {'name': 'Education', 'color': colorService.generateColor()},
                {'name': 'Gas', 'color': colorService.generateColor()}, // 5
                {'name': 'Medical', 'color': colorService.generateColor()},
                {'name': 'Restaurant', 'color': colorService.generateColor()},
                {'name': 'Grocery', 'color': colorService.generateColor()},
                {'name': 'Travel', 'color': colorService.generateColor()},
                {'name': 'Insurance', 'color': colorService.generateColor()}, // 10
                {'name': 'Debt', 'color': colorService.generateColor()},
                {'name': 'Savings', 'color': colorService.generateColor()},
                {'name': 'Gym', 'color': colorService.generateColor()},
                {'name': 'Sports', 'color': colorService.generateColor()},
                {'name': 'Gifts', 'color': colorService.generateColor()}, // 15
                {'name': 'Personal Care', 'color': colorService.generateColor()},
                {'name': 'Investment', 'color': colorService.generateColor()},
                {'name': 'Utilities', 'color': colorService.generateColor()}, // 18
                {'name': 'Bar', 'color': colorService.generateColor()},
                {'name': 'Store', 'color': colorService.generateColor()}, // 20
                {'name': 'Video Games', 'color': colorService.generateColor()},
                {'name': 'Clothes', 'color': colorService.generateColor()},
                {'name': 'Movies', 'color': colorService.generateColor()},
                {'name': 'Rent', 'color': colorService.generateColor()}, // 24
                {'name': 'Computer', 'color': colorService.generateColor()},
                {'name': 'Technology', 'color': colorService.generateColor()},
                {'name': '27th', 'color': colorService.generateColor()}
            ]);
    }

}
